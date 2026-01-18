
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
const PCF_NAME = 'Charis PCF';
const CSV_FILE = 'attached_assets/CHARIS_PCF_DATABASE_NEW_-_Sheet1_1768714468295.csv';

// Valid dropdown values (Based on schema/RBAC logic)
const VALID_TITLES = ['PASTOR', 'DEACON', 'DEACONESS', 'BROTHER', 'SISTER'];
const VALID_DESIGNATIONS = ['MEMBER', 'CELL_LEADER', 'PCF_LEADER', 'GROUP_PASTOR', 'PASTORAL_ASSISTANT'];

function normalizeName(name: string): string {
  if (!name) return '';
  return name.trim().toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

function normalizePhone(phone: string): string {
  if (!phone) return '';
  return phone.replace(/[^0-9+]/g, '');
}

function normalizeCellName(cellName: string): string {
  if (!cellName) return '';
  return cellName.replace(/ cell$/i, '').trim();
}

async function runImport() {
  console.log('Starting Charis PCF Import...');

  const csvContent = fs.readFileSync(CSV_FILE, 'utf-8');
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  });

  // 1. Find Charis PCF
  const [pcf] = await db.select().from(pcfs).where(eq(pcfs.name, PCF_NAME)).limit(1);
  if (!pcf) {
    console.error(`Error: ${PCF_NAME} not found in database. Please ensure the PCF exists first.`);
    process.exit(1);
  }
  console.log(`Found PCF: ${pcf.name} (ID: ${pcf.id})`);

  let successCount = 0;
  let skipCount = 0;

  for (const record of records) {
    const rawTitle = (record['TITLE'] || '').trim().toUpperCase();
    const rawName = (record['NAME'] || '').trim();
    const rawSurname = (record['SURNAME'] || '').trim();
    const rawPhone = (record['PHONE NUMBER'] || record['CELL'] || '').trim();
    const rawDesignation = (record['DESIGNATION '] || record['DESIGNATION'] || 'MEMBER').trim().toUpperCase().replace(' ', '_');
    const rawCell = (record['CELL'] || '').trim();
    const rawEmail = (record['EMAIL ADDRESS'] || '').trim();
    const rawBirthday = (record['BIRTHDAY '] || record['BIRTHDAY'] || '').trim();

    // Validations
    if (!rawName) {
      console.log(`Skipping row: Missing name. Data: ${JSON.stringify(record)}`);
      skipCount++;
      continue;
    }

    if (!VALID_TITLES.includes(rawTitle)) {
      console.log(`Skipping row: Invalid title "${rawTitle}" for ${rawName} ${rawSurname}`);
      skipCount++;
      continue;
    }

    const designation = VALID_DESIGNATIONS.includes(rawDesignation) ? rawDesignation : 'MEMBER';

    // Cell Resolution
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

    // Member Creation/Update
    const fullName = `${normalizeName(rawName)} ${normalizeName(rawSurname)}`.trim();
    const phone = normalizePhone(rawPhone);
    const email = rawEmail || null;

    // Check for existing member by email
    let memberId: number;
    if (email) {
      const [existing] = await db.select().from(members).where(eq(members.email, email)).limit(1);
      if (existing) {
        console.log(`Member already exists with email ${email}. Skipping.`);
        skipCount++;
        continue;
      }
    }

    // Birthday Parsing (Simplified for now, assuming integer fields in schema)
    // birthDay: integer, birthMonth: integer
    // OCTOBER 15TH
    let birthDay: number | null = null;
    let birthMonth: number | null = null;
    if (rawBirthday) {
      const months = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];
      const match = rawBirthday.match(/([A-Z]+)\s*(\d+)/i);
      if (match) {
        const monthIndex = months.indexOf(match[1].toUpperCase());
        if (monthIndex !== -1) {
          birthMonth = monthIndex + 1;
          birthDay = parseInt(match[2]);
        }
      }
    }

    const [member] = await db.insert(members).values({
      fullName,
      phone,
      email,
      title: rawTitle,
      designation,
      cellId,
      birthDay,
      birthMonth,
      status: 'Active'
    }).returning();
    memberId = member.id;

    // Leadership Logic
    if (designation === 'CELL_LEADER' && cellId) {
      // Ensure user account
      const userEmail = email || `cell_leader_${memberId}@church.local`;
      const [existingUser] = await db.select().from(users).where(eq(users.email, userEmail)).limit(1);

      if (!existingUser) {
        const tempPassword = crypto.randomBytes(8).toString('hex');
        const hashedPassword = await bcrypt.hash(tempPassword, 10);
        
        await db.insert(users).values({
          email: userEmail,
          password: hashedPassword,
          role: UserRoles.CELL_LEADER,
          firstName: normalizeName(rawName),
          lastName: normalizeName(rawSurname),
          memberId: memberId,
          cellId: cellId,
          pcfId: pcf.id,
          groupId: pcf.groupId,
          forcePasswordChange: true
        });

        // Assign as leader of the cell
        await db.update(cells).set({ leaderId: sql`id::text` }).where(eq(cells.id, cellId)); 
        // Note: The logic in routes.ts uses user UUID as leaderId in cells table
        // But we need the actual user ID we just created.
        const [newUser] = await db.select().from(users).where(eq(users.memberId, memberId)).limit(1);
        await db.update(cells).set({ leaderId: newUser.id }).where(eq(cells.id, cellId));

        console.log(`Created user for Cell Leader: ${fullName} (${userEmail}) / Password: ${tempPassword}`);
      }
    }

    successCount++;
  }

  console.log(`Import complete! Success: ${successCount}, Skipped: ${skipCount}`);
  process.exit(0);
}

runImport().catch(err => {
  console.error('Import failed:', err);
  process.exit(1);
});
