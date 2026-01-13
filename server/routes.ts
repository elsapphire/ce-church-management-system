import type { Express } from "express";
import type { Server } from "http";
import { setupAuth } from "./replit_integrations/auth"; // Created by blueprint
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Auth removed for preview

  // === HIERARCHY ===
  app.get(api.hierarchy.get.path, async (req, res) => {
    const church = await storage.getChurch();
    if (!church) {
        // Return empty structure if not seeded yet
        return res.json({ church: null, groups: [], pcfs: [], cells: [] });
    }
    const groups = await storage.getGroups(church.id);
    // Flattened lists for simplicity, in real app might nest
    const allPcfs = [];
    for (const g of groups) allPcfs.push(...await storage.getPcfs(g.id));
    
    const allCells = [];
    for (const p of allPcfs) allCells.push(...await storage.getCells(p.id));

    res.json({
        church,
        groups,
        pcfs: allPcfs,
        cells: allCells
    });
  });

  // === MEMBERS ===
  app.get(api.members.list.path, async (req, res) => {
    // Filter logic can be added to storage
    const members = await storage.getMembers();
    res.json(members);
  });

  app.get(api.members.get.path, async (req, res) => {
    const member = await storage.getMember(Number(req.params.id));
    if (!member) return res.status(404).json({ message: "Member not found" });
    res.json(member);
  });

  app.post(api.members.create.path, async (req, res) => {
    try {
      const input = api.members.create.input.parse(req.body);
      const member = await storage.createMember(input);
      res.status(201).json(member);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.put(api.members.update.path, async (req, res) => {
    try {
        const input = api.members.update.input.parse(req.body);
        const member = await storage.updateMember(Number(req.params.id), input);
        res.json(member);
    } catch (err) {
        res.status(400).json({ message: "Invalid update" });
    }
  });

  app.delete(api.members.delete.path, async (req, res) => {
    await storage.deleteMember(Number(req.params.id));
    res.status(204).send();
  });

  // === SERVICES ===
  app.get(api.services.list.path, async (req, res) => {
    const services = await storage.getServices();
    res.json(services);
  });

  app.post(api.services.create.path, async (req, res) => {
    try {
        const input = api.services.create.input.parse(req.body);
        const service = await storage.createService(input);
        res.status(201).json(service);
    } catch (err) {
        res.status(400).json({ message: "Invalid service data" });
    }
  });

  app.patch(api.services.update.path, async (req, res) => {
    try {
        const input = api.services.update.input.parse(req.body);
        const service = await storage.updateService(Number(req.params.id), input);
        res.json(service);
    } catch (err) {
        res.status(400).json({ message: "Invalid update" });
    }
  });

  // === ATTENDANCE ===
  app.post(api.attendance.mark.path, async (req, res) => {
    try {
        const input = api.attendance.mark.input.parse(req.body);
        const record = await storage.markAttendance(input);
        res.status(201).json(record);
    } catch (err) {
        res.status(400).json({ message: "Invalid attendance data" });
    }
  });

  app.get(api.attendance.list.path, async (req, res) => {
    const serviceId = Number(req.query.serviceId);
    if (!serviceId) return res.status(400).json({ message: "serviceId required" });
    const records = await storage.getAttendanceForService(serviceId);
    res.json(records);
  });

  app.get(api.attendance.stats.path, async (req, res) => {
    const serviceId = req.query.serviceId ? Number(req.query.serviceId) : undefined;
    const stats = await storage.getAttendanceStats(serviceId);
    res.json(stats);
  });

  // === SEED DATA ===
  await seedData();

  return httpServer;
}

async function seedData() {
  const existingChurch = await storage.getChurch();
  if (existingChurch) return;

  console.log("Seeding database...");
  
  // 1. Church
  const church = await storage.createChurch("Christ Embassy Abuja Zone 1", "Abuja, Nigeria");
  
  // 2. Group
  const group = await storage.createGroup({ name: "Immanent in Wisdom 1 Group", churchId: church.id });
  
  // 3. PCF
  const pcf = await storage.createPcf({ name: "Prolific PCF", groupId: group.id });
  
  // 4. Cells
  const cellNames = ["Grace Cell", "Wisdom Cell", "Dominion Cell"];
  const cells = [];
  for (const name of cellNames) {
    cells.push(await storage.createCell({ name, pcfId: pcf.id }));
  }

  // 5. Members
  const memberData = [
    { fullName: "John Doe", phone: "1234567890", gender: "Male", cellId: cells[0].id },
    { fullName: "Jane Smith", phone: "0987654321", gender: "Female", cellId: cells[0].id },
    { fullName: "Peter Pan", phone: "1122334455", gender: "Male", cellId: cells[1].id },
    { fullName: "Mary Poppins", phone: "5544332211", gender: "Female", cellId: cells[1].id },
    { fullName: "Bruce Wayne", phone: "9999999999", gender: "Male", cellId: cells[2].id },
    { fullName: "Clark Kent", phone: "8888888888", gender: "Male", cellId: cells[2].id },
    { fullName: "Diana Prince", phone: "7777777777", gender: "Female", cellId: cells[2].id },
    { fullName: "Barry Allen", phone: "6666666666", gender: "Male", cellId: cells[0].id },
    { fullName: "Arthur Curry", phone: "5555555555", gender: "Male", cellId: cells[1].id },
    { fullName: "Hal Jordan", phone: "4444444444", gender: "Male", cellId: cells[2].id },
  ];

  for (const m of memberData) {
    await storage.createMember(m);
  }

  // 6. Services
  const service = await storage.createService({
    name: "Sunday Service",
    date: new Date(),
    startTime: "08:00",
    endTime: "10:00",
    active: true
  });

  console.log("Seeding complete!");
}
