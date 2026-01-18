
import { db } from '../server/db';
import { 
  members, cells, pcfs,
  type InsertMember, type InsertCell
} from '../shared/schema';
import { eq, and, sql } from 'drizzle-orm';

const PCF_NAME = 'Insight PCF';
const CELL_NAME = 'Insight Cell';

const membersToImport = [
  { name: 'Giwa David', phone: '8039736565' },
  { name: 'Daniel Orji Madubuike', phone: '8064308382' },
  { name: 'Ezinne Orji Joy', phone: '8051444393' },
  { name: 'Elem Divine George', phone: '9018575269' },
  { name: 'Samson Okoh', phone: '' },
  { name: 'Charity Okoh', phone: '' },
];

function normalizeName(name: string): string {
  if (!name) return '';
  return name.trim().toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

async function runImport() {
  console.log(`Starting ${PCF_NAME} / ${CELL_NAME} Import...`);

  // 1. Find Insight PCF
  let [pcf] = await db.select().from(pcfs).where(eq(pcfs.name, PCF_NAME)).limit(1);
  if (!pcf) {
    // If PCF doesn't exist, we might need a group first. 
    // Usually these are pre-existing or created in a specific way.
    // For this script, we'll assume it exists or try to find any group to attach it to if it doesn't.
    console.error(`Error: ${PCF_NAME} not found. Searching for default group...`);
    const [defaultGroup] = await db.select().from(sql`groups`).limit(1);
    if (!defaultGroup) {
      console.error("No groups found in database. Cannot create PCF.");
      process.exit(1);
    }
    
    [pcf] = await db.insert(pcfs).values({
      name: PCF_NAME,
      groupId: (defaultGroup as any).id
    }).returning();
    console.log(`Created PCF: ${PCF_NAME}`);
  }

  // 2. Find or Create Insight Cell
  let [cell] = await db.select().from(cells).where(
    and(
      eq(cells.pcfId, pcf.id),
      eq(cells.name, CELL_NAME)
    )
  ).limit(1);

  if (!cell) {
    [cell] = await db.insert(cells).values({
      name: CELL_NAME,
      pcfId: pcf.id
    }).returning();
    console.log(`Created Cell: ${CELL_NAME}`);
  }

  let successCount = 0;
  for (const memberData of membersToImport) {
    const fullName = normalizeName(memberData.name);
    const phone = memberData.phone || null;

    // Check for duplicates by name and phone (since email is null)
    const [existing] = await db.select().from(members).where(
      and(
        eq(members.fullName, fullName),
        phone ? eq(members.phone, phone) : sql`phone IS NULL`
      )
    ).limit(1);

    if (existing) {
      console.log(`Member already exists: ${fullName}. Skipping.`);
      continue;
    }

    await db.insert(members).values({
      fullName,
      phone,
      cellId: cell.id,
      designation: 'MEMBER',
      status: 'Active',
      title: 'BROTHER' // Default title
    });
    console.log(`Imported: ${fullName}`);
    successCount++;
  }

  console.log(`Import complete! Success: ${successCount}`);
  process.exit(0);
}

runImport().catch(err => {
  console.error('Import failed:', err);
  process.exit(1);
});
