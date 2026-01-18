
import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { db } from '../server/db';
import { 
  members, cells, pcfs, groups, users,
  type InsertMember, type InsertCell, type UserRole
} from '../shared/schema';
import { UserRoles } from '../shared/models/auth';
import { eq, and, sql } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

// Configuration
const PCF_NAME = 'Exclusive PCF';
const CSV_FILE = 'attached_assets/PCF_DATABASE_-_Sheet1_1768724855131.csv';

// Valid dropdown values (Based on schema/RBAC logic)
const VALID_TITLES = ['PASTOR', 'DEACON', 'DEACONESS', 'BRO', 'SIS', 'BROTHER', 'SISTER', 'PST', 'PASTOR '];

function normalizeName(name: string): string {
  if (!name) return '';
  return name.trim().toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

function normalizePhone(phone: string): string {
  if (!phone) return '';
  return phone.replace(/[^0-9+]/g, '').split(',')[0].trim();
}

function normalizeCellName(cellName: string): string {
  if (!cellName) return '';
  // "Exclusive" and "Exclusive Cell" -> same cell
  let name = cellName.trim().replace(/ cell$/i, '').trim();
  if (name.toLowerCase() === 'exclusive') return 'Exclusive';
  return name;
}

function parseBirthday(rawBirthday: string) {
  if (!rawBirthday) return { birthDay: null, birthMonth: null };
  
  const months = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];
  const monthAbbreviations: Record<string, string> = {
    'JAN': 'JANUARY', 'FEB': 'FEBRUARY', 'MAR': 'MARCH', 'APR': 'APRIL', 'MAY': 'MAY', 'JUN': 'JUNE',
    'JUL': 'JULY', 'AUG': 'AUGUST', 'SEP': 'SEPTEMBER', 'SEPT': 'SEPTEMBER', 'OCT': 'OCTOBER', 'NOV': 'NOVEMBER', 'DEC': 'DECEMBER'
  };

  // Try format: 21ST JANUARY or 21-JAN or JANUARY 21
  let day: number | null = null;
  let month: number | null = null;

  const cleanBirthday = rawBirthday.toUpperCase().trim();
  
  // Try matching month name and day
  for (let i = 0; i < months.length; i++) {
    if (cleanBirthday.includes(months[i])) {
      month = i + 1;
      const dayMatch = cleanBirthday.match(/\d+/);
      if (dayMatch) day = parseInt(dayMatch[0]);
      break;
    }
  }

  if (!month) {
    for (const [abbr, full] of Object.entries(monthAbbreviations)) {
      if (cleanBirthday.includes(abbr)) {
        month = months.indexOf(full) + 1;
        const dayMatch = cleanBirthday.match(/\d+/);
        if (dayMatch) day = parseInt(dayMatch[0]);
        break;
      }
    }
  }

  return { birthDay: day, birthMonth: month };
}

async function runImport() {
  console.log(`Starting ${PCF_NAME} Import...`);

  if (!fs.existsSync(CSV_FILE)) {
    console.error(`Error: CSV file not found at ${CSV_FILE}`);
    process.exit(1);
  }

  const csvContent = fs.readFileSync(CSV_FILE, 'utf-8');
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  // 1. Find Exclusive PCF
  const [pcf] = await db.select().from(pcfs).where(eq(pcfs.name, PCF_NAME)).limit(1);
  if (!pcf) {
    console.error(`Error: ${PCF_NAME} not found in database. Please ensure the PCF exists first.`);
    process.exit(1);
  }
  console.log(`Found PCF: ${pcf.name} (ID: ${pcf.id})`);

  let successCount = 0;
  let updateCount = 0;
  let skipCount = 0;

  for (const record of records) {
    const rawTitle = (record['TITLE'] || '').trim().toUpperCase();
    const rawName = (record['NAME'] || '').trim();
    const rawSurname = (record['SURNAME'] || '').trim();
    const rawPhone = (record['PHONE NUMBER'] || '').trim();
    const rawDesignation = (record['DESIGNATION '] || record['DESIGNATION'] || 'MEMBER').trim().toUpperCase();
    const rawCell = (record['CELL'] || '').trim();
    const rawEmail = (record['EMAIL ADDRESS'] || '').trim();
    const rawBirthday = (record['BIRTHDAY '] || record['BIRTHDAY'] || '').trim();

    if (!rawName && !rawSurname) {
      skipCount++;
      continue;
    }

    // Rule 1: Title matching
    let title = VALID_TITLES.find(t => t === rawTitle) || 'BROTHER';
    if (title === 'BRO') title = 'BROTHER';
    if (title === 'SIS') title = 'SISTER';
    if (title === 'PST') title = 'PASTOR';
    if (title.startsWith('PASTOR')) title = 'PASTOR';

    // Rule 2 & 7: Designation mapping
    let designation = 'MEMBER';
    if (rawDesignation.includes('CELL_LEADER') || rawDesignation.includes('CELL LEADER')) {
      designation = 'CELL_LEADER';
    } else if (rawDesignation.includes('PCF_LEADER') || rawDesignation.includes('PCF LEADER')) {
      designation = 'PCF_LEADER';
    }

    // Rule 3: Cells creation/resolution
    let cellId: number | null = null;
    if (rawCell) {
      const normalizedCell = normalizeCellName(rawCell);
      const [existingCell] = await db.select().from(cells).where(
        and(
          eq(cells.pcfId, pcf.id),
          sql`LOWER(${cells.name}) = ${normalizedCell.toLowerCase()}`
        )
      ).limit(1);

      if (existingCell) {
        cellId = existingCell.id;
      } else {
        const [newCell] = await db.insert(cells).values({
          name: normalizedCell,
          pcfId: pcf.id
        }).returning();
        cellId = newCell.id;
        console.log(`Created new cell: ${normalizedCell}`);
      }
    }

    // Rule 5: Proper Case Names
    const fullName = `${normalizeName(rawName)} ${normalizeName(rawSurname)}`.trim();
    const phone = normalizePhone(rawPhone);
    const email = rawEmail && rawEmail.trim() !== "" ? rawEmail.trim().toLowerCase() : null;

    // Rule 6: Birthday
    const { birthDay, birthMonth } = parseBirthday(rawBirthday);

    // Rule 4: Email check (Update or Insert)
    let memberId: number;
    if (email) {
      const [existing] = await db.select().from(members).where(eq(members.email, email)).limit(1);
      if (existing) {
        const [updated] = await db.update(members).set({
          fullName,
          phone,
          title,
          designation,
          cellId,
          birthDay,
          birthMonth,
        }).where(eq(members.id, existing.id)).returning();
        memberId = updated.id;
        updateCount++;
      } else {
        const [newMember] = await db.insert(members).values({
          fullName,
          phone,
          email,
          title,
          designation,
          cellId,
          birthDay,
          birthMonth,
          status: 'Active'
        }).returning();
        memberId = newMember.id;
        successCount++;
      }
    } else {
      const [newMember] = await db.insert(members).values({
        fullName,
        phone,
        email: null,
        title,
        designation,
        cellId,
        birthDay,
        birthMonth,
        status: 'Active'
      }).returning();
      memberId = newMember.id;
      successCount++;
    }

    // Leadership Logic
    if (designation === 'CELL_LEADER' && cellId) {
      // Rule 4: Only create user account if email is present
      if (email) {
        const [existingUser] = await db.select().from(users).where(eq(users.email, email)).limit(1);
        let userId: string;

        if (!existingUser) {
          const tempPassword = crypto.randomBytes(8).toString('hex');
          const hashedPassword = await bcrypt.hash(tempPassword, 10);
          
          const [newUser] = await db.insert(users).values({
            email: email,
            password: hashedPassword,
            role: UserRoles.CELL_LEADER,
            firstName: normalizeName(rawName),
            lastName: normalizeName(rawSurname),
            memberId: memberId,
            cellId: cellId,
            pcfId: pcf.id,
            groupId: pcf.groupId,
            forcePasswordChange: true
          }).returning();
          userId = newUser.id;
          console.log(`Created user for Cell Leader: ${fullName} (${email}) / Password: ${tempPassword}`);
        } else {
          userId = existingUser.id;
          await db.update(users).set({
            cellId: cellId,
            memberId: memberId,
            role: UserRoles.CELL_LEADER
          }).where(eq(users.id, userId));
        }

        // Assign as leader of the cell
        await db.update(cells).set({ leaderId: userId }).where(eq(cells.id, cellId));
      } else {
        console.log(`Warning: Cell leader ${fullName} has no email. No user account created.`);
      }
    }
  }

  console.log(`Import complete! New: ${successCount}, Updated: ${updateCount}, Skipped: ${skipCount}`);
  process.exit(0);
}

runImport().catch(err => {
  console.error('Import failed:', err);
  process.exit(1);
});
