import { storage } from "../server/storage";
import { db } from "../server/db";
import { pcfs, cells, members } from "../shared/schema";
import { eq, and } from "drizzle-orm";

async function importDominionPCF() {
  console.log("Starting Dominion PCF Import...");

  // 1. Resolve Hierarchy
  const [dominionPcf] = await db.select().from(pcfs).where(eq(pcfs.name, "Dominion PCF")).limit(1);
  if (!dominionPcf) {
    console.error("Error: Dominion PCF not found!");
    process.exit(1);
  }

  const [dominionCell] = await db.select().from(cells).where(
    and(
      eq(cells.name, "Dominion"),
      eq(cells.pcfId, dominionPcf.id)
    )
  ).limit(1);

  if (!dominionCell) {
    console.error("Error: Dominion not found in Dominion PCF!");
    process.exit(1);
  }

  const rawData = [
    { name: "Emmanuel God'spower", phone: "7082271823" },
    { name: "Victor Maxwell", phone: "802497683" },
    { name: "Onuh Ifeanyi", phone: "7068937371" },
    { name: "Makwe Chinaza", phone: "9030152887" },
    { name: "Jace Makwe", phone: "8030499443" },
    { name: "Franca Aide", phone: "7034427346" },
    { name: "Elizabeth Emodeh", phone: "9041713112" },
    { name: "Ifeoma Uga", phone: "8020829911" },
    { name: "Rose Obi", phone: "7065583116" },
    { name: "Arome", phone: "90315557" },
    { name: "Sinclaire Akwaramudu", phone: "8101862592" },
    { name: "Thelma Akwaramudu", phone: "8066301052" },
    { name: "Enoch Emmanuel", phone: "9036329137" }
  ];

  function toTitleCase(str: string) {
    return str.toLowerCase().split(' ').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  }

  let importedCount = 0;
  for (const item of rawData) {
    try {
      const formattedName = toTitleCase(item.name.trim());
      
      // Clean phone: ensure it's a string and handle leading zeros if missing (though user provided them without 0 prefix mostly)
      // Actually user provided 10 digits mostly, so we just store as is but ensure string.
      let phone = item.phone.trim();
      if (phone.length === 10) phone = "0" + phone;

      await storage.createMember({
        fullName: formattedName,
        phone: phone,
        email: null,
        gender: "Male", // Default to Male as placeholder, can be updated
        title: "Brother", // Default title
        designation: "MEMBER",
        status: "Active",
        cellId: dominionCell.id,
        birthDay: null,
        birthMonth: null
      });
      
      console.log(`Imported: ${formattedName}`);
      importedCount++;
    } catch (err: any) {
      console.error(`Failed to import ${item.name}:`, err.message);
    }
  }

  console.log("\nImport Summary:");
  console.log(`Total members imported: ${importedCount}`);
  console.log(`PCF assigned: ${dominionPcf.name}`);
  console.log(`Cell assigned: ${dominionCell.name}`);
}

importDominionPCF().catch(console.error);
