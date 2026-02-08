import { db } from "../server/db";
import { users, groups, pcfs, cells, members, churches } from "../shared/schema";
import { eq, or } from "drizzle-orm";
import bcrypt from "bcrypt";
import fs from "fs";
import { parse } from "csv-parse/sync";

async function hashPassword(password: string) {
  return await bcrypt.hash(password, 10);
}

async function run() {
  console.log("Starting one-time data import...");

  // 1) Create Users
  const userList = [
    { email: "admin@cecms.com", password: "cecmsadmin2025!!", role: "admin" },
    { email: "ohiselohim@gmail.com", password: "cecmsgp2025!!", role: "group_pastor" }
  ];

  const createdUsers: Record<string, string> = {};

  for (const u of userList) {
    const [existing] = await db.select().from(users).where(eq(users.email, u.email));
    if (!existing) {
      const hashedPassword = await hashPassword(u.password);
      const [newUser] = await db.insert(users).values({
        id: crypto.randomUUID(),
        email: u.email,
        password: hashedPassword,
        role: u.role as any
      }).returning();
      console.log(`User created: ${u.email}`);
      createdUsers[u.email] = newUser.id;
    } else {
      console.log(`User skipped (exists): ${u.email}`);
      createdUsers[u.email] = existing.id;
    }
  }

  // 2) Create Group
  const groupName = "Immanent in Wisdom 1";
  let groupId: number;
  const [existingGroup] = await db.select().from(groups).where(eq(groups.name, groupName));

  const [church] = await db.select({ id: churches.id }).from(churches).limit(1);
  if (!church) {
    console.log("No church found. Creating a default church...");
    const [newChurch] = await db.insert(churches).values({ name: "Main Church", address: "Abuja" }).returning();
    var churchId = newChurch.id;
  } else {
    var churchId = church.id;
  }

  if (!existingGroup) {
    const [newGroup] = await db.insert(groups).values({
      name: groupName,
      churchId: churchId,
      leaderId: createdUsers["ohiselohim@gmail.com"]
    }).returning();
    groupId = newGroup.id;
    console.log(`Group created: ${groupName}`);
  } else {
    groupId = existingGroup.id;
    await db.update(groups).set({ leaderId: createdUsers["ohiselohim@gmail.com"] }).where(eq(groups.id, groupId));
    console.log(`Group skipped (exists), leader assigned: ${groupName}`);
  }

  // 3) Create PCFs
  const pcfNames = ["Prolific PCF", "Charis PCF", "Exclusive PCF"];
  const pcfMap: Record<string, number> = {};

  for (const name of pcfNames) {
    const [existingPcf] = await db.select().from(pcfs).where(eq(pcfs.name, name));
    if (!existingPcf) {
      const [newPcf] = await db.insert(pcfs).values({
        name,
        groupId: groupId
      }).returning();
      pcfMap[name] = newPcf.id;
      console.log(`PCF created: ${name}`);
    } else {
      pcfMap[name] = existingPcf.id;
      console.log(`PCF skipped (exists): ${name}`);
    }
  }

  // 4) Import Members
  const files = [
    { path: "attached_assets/THE_PROLIFIC_PCF_3_DATABASE_(1)_-_Sheet1_(1)_1770535212989.csv", pcf: "Prolific PCF" },
    { path: "attached_assets/CHARIS_PCF_DATABASE_NEW_-_Sheet1_(1)_1770535208777.csv", pcf: "Charis PCF" },
    { path: "attached_assets/Exclusive_PCF_-_Sheet1_1770535208779.csv", pcf: "Exclusive PCF" }
  ];

  for (const file of files) {
    if (!fs.existsSync(file.path)) {
      console.error(`File not found: ${file.path}`);
      continue;
    }

    const content = fs.readFileSync(file.path, "utf-8");
    const records = parse(content, { columns: true, skip_empty_lines: true, trim: true });
    const pcfId = pcfMap[file.pcf];
    let imported = 0;
    let skipped = 0;

    for (const record of records) {
      const title = record["TITLE"];
      const firstName = record["NAME"];
      const lastName = record["SURNAME"];
      const phone = record["PHONE NUMBER"]?.replace(/[",\s]/g, "");
      const designation = record["DESIGNATION "] || record["DESIGNATION"] || "MEMBER";
      const cellName = record["CELL"];
      const email = record["EMAIL ADDRESS"]?.toLowerCase().trim() || null;

      if (!firstName && !lastName) {
        skipped++;
        continue;
      }

      let existingMember = null;
      if (email || phone) {
        const conditions = [];
        if (email) conditions.push(eq(members.email, email));
        if (phone) conditions.push(eq(members.phone, phone));
        
        [existingMember] = await db.select().from(members).where(or(...conditions)).limit(1);
      }

      if (existingMember) {
        skipped++;
        continue;
      }

      let cellId = null;
      if (cellName) {
        const [existingCell] = await db.select().from(cells).where(eq(cells.name, cellName)).limit(1);
        if (existingCell) {
          cellId = existingCell.id;
        } else {
          const [newCell] = await db.insert(cells).values({ name: cellName, pcfId }).returning();
          cellId = newCell.id;
        }
      }

      await db.insert(members).values({
        fullName: `${firstName} ${lastName}`.trim(),
        title,
        phone,
        email,
        designation,
        cellId,
        status: "Active"
      });
      imported++;
    }
    console.log(`Imported ${imported} members for ${file.pcf} (skipped ${skipped})`);
  }

  console.log("Data import completed successfully.");
  process.exit(0);
}

run().catch(err => {
  console.error("Import failed:", err);
  process.exit(1);
});
