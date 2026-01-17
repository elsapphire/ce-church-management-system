import bcrypt from "bcrypt";
import type { Express } from "express";
import type { Server } from "http";
import { setupLocalAuth, seedDummyUsers } from "./auth";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { loadUser, requireAuth, canMarkAttendance, getAccessibleCellIds, getAccessiblePcfIds, requireRoles } from "./rbac";
import { UserRoles } from "@shared/models/auth";
import { pcfs, cells } from "@shared/schema";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  setupLocalAuth(app);
  
  app.use(loadUser);
  
  await seedDummyUsers();

  // === HIERARCHY ===
  app.get(api.hierarchy.get.path, requireAuth, async (req, res) => {
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
  app.get(api.members.list.path, requireAuth, async (req, res) => {
    const accessibleCellIds = await getAccessibleCellIds(req.user!);
    const allMembers = await storage.getMembers();
    
    if (req.user!.role === UserRoles.ADMIN) {
      return res.json(allMembers);
    }
    
    const filteredMembers = allMembers.filter(m => 
      m.cellId && accessibleCellIds.includes(m.cellId)
    );
    res.json(filteredMembers);
  });

  app.get(api.members.get.path, requireAuth, async (req, res) => {
    const member = await storage.getMember(Number(req.params.id));
    if (!member) return res.status(404).json({ message: "Member not found" });
    
    if (req.user!.role !== UserRoles.ADMIN) {
      const accessibleCellIds = await getAccessibleCellIds(req.user!);
      if (!member.cellId || !accessibleCellIds.includes(member.cellId)) {
        return res.status(403).json({ message: "Access denied" });
      }
    }
    
    res.json(member);
  });

  app.post(api.members.create.path, requireAuth, async (req, res) => {
    try {
      const input = api.members.create.input.parse(req.body);
      const role = req.user?.role;
      
      // Tiered member creation permissions
      if (role === UserRoles.ADMIN) {
        // Admin can add members anywhere
      } else if (role === UserRoles.GROUP_PASTOR) {
        // Group Pastor can add members to cells in their group
        const accessibleCellIds = await getAccessibleCellIds(req.user!);
        if (!input.cellId || !accessibleCellIds.includes(input.cellId)) {
          return res.status(403).json({ message: "You can only add members to cells in your group" });
        }
      } else if (role === UserRoles.PCF_LEADER) {
        // PCF Leader can add members to cells in their PCF
        const accessibleCellIds = await getAccessibleCellIds(req.user!);
        if (!input.cellId || !accessibleCellIds.includes(input.cellId)) {
          return res.status(403).json({ message: "You can only add members to cells in your PCF" });
        }
      } else if (role === UserRoles.CELL_LEADER) {
        // Cell Leader can only add members to their own cell
        if (input.cellId !== req.user?.cellId) {
          return res.status(403).json({ message: "You can only add members to your own cell" });
        }
      } else {
        return res.status(403).json({ message: "You do not have permission to add members" });
      }
      
      const member = await storage.createMember(input);
      res.status(201).json(member);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.put(api.members.update.path, requireAuth, async (req, res) => {
    try {
        const input = api.members.update.input.parse(req.body);
        const member = await storage.updateMember(Number(req.params.id), input);
        res.json(member);
    } catch (err) {
        res.status(400).json({ message: "Invalid update" });
    }
  });

  app.delete(api.members.delete.path, requireAuth, async (req, res) => {
    await storage.deleteMember(Number(req.params.id));
    res.status(204).send();
  });

  // === SERVICES ===
  app.get(api.services.list.path, requireAuth, async (req, res) => {
    const services = await storage.getServices();
    res.json(services);
  });

  app.post(api.services.create.path, requireAuth, async (req, res) => {
    try {
        const input = api.services.create.input.parse(req.body);
        const service = await storage.createService(input);
        res.status(201).json(service);
    } catch (err) {
        res.status(400).json({ message: "Invalid service data" });
    }
  });

  app.patch(api.services.update.path, requireAuth, async (req, res) => {
    try {
        const input = api.services.update.input.parse(req.body);
        const service = await storage.updateService(Number(req.params.id), input);
        res.json(service);
    } catch (err) {
        res.status(400).json({ message: "Invalid update" });
    }
  });

  // === ATTENDANCE ===
  app.post(api.attendance.mark.path, canMarkAttendance, async (req, res) => {
    try {
        const input = api.attendance.mark.input.parse(req.body);
        const record = await storage.markAttendance(input);
        res.status(201).json(record);
    } catch (err) {
        res.status(400).json({ message: "Invalid attendance data" });
    }
  });

  app.get(api.attendance.list.path, requireAuth, async (req, res) => {
    const serviceId = Number(req.query.serviceId);
    if (!serviceId) return res.status(400).json({ message: "serviceId required" });
    const records = await storage.getAttendanceForService(serviceId);
    res.json(records);
  });

  app.get(api.attendance.stats.path, requireAuth, async (req, res) => {
    const serviceId = req.query.serviceId ? Number(req.query.serviceId) : undefined;
    const stats = await storage.getAttendanceStats(serviceId);
    res.json(stats);
  });

  // === USERS (for leader selection dropdowns) ===
  app.get("/api/users", requireAuth, async (req, res) => {
    const allUsers = await storage.getAllUsers();
    const safeUsers = allUsers.map(u => ({
      id: u.id,
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      title: u.title,
      role: u.role,
    }));
    res.json(safeUsers);
  });

  // === STRUCTURE (Tiered permissions) ===
  // Helper to validate leader assignment - only allow promoting users who are currently "member" role
  // This prevents privilege escalation (e.g., reassigning another admin or existing leader)
  async function validateLeaderAssignment(leaderId: string | undefined): Promise<{ valid: boolean; error?: string }> {
    if (!leaderId) return { valid: true };
    const targetUser = await storage.getUser(leaderId);
    if (!targetUser) {
      return { valid: false, error: "Selected leader does not exist" };
    }
    // Only allow promoting members to prevent privilege escalation
    if (targetUser.role && targetUser.role !== (UserRoles as any).MEMBER && targetUser.role !== "member") {
      return { valid: false, error: "Selected user already has a leadership role. Only members can be promoted to leaders." };
    }
    return { valid: true };
  }

  // Groups: Admin only
  app.post("/api/admin/groups", requireAuth, async (req, res) => {
    if (req.user?.role !== UserRoles.ADMIN) {
      return res.status(403).json({ message: "Only Zonal Pastor can create groups" });
    }
    const { leaderId, createUser, userEmail, userPassword, userRole, ...groupData } = req.body;
    
    // Validate user creation data if requested
    if (createUser) {
      if (!userEmail || !userPassword) {
        return res.status(400).json({ message: "Email and password are required for user creation" });
      }
      
      const existingUser = await storage.getUserByEmail(userEmail);
      if (existingUser) {
        return res.status(400).json({ message: "Email already in use" });
      }

      if (leaderId) {
        const existingUserByMember = await storage.getUserByMemberId(Number(leaderId));
        if (existingUserByMember) {
          return res.status(400).json({ message: "This member already has a user account" });
        }
      }
    }
    
    // Validate leader assignment
    const leaderValidation = await validateLeaderAssignment(leaderId);
    if (!leaderValidation.valid) {
      return res.status(400).json({ message: leaderValidation.error });
    }
    
    const group = await storage.createGroup({ ...groupData, leaderId });

    if (createUser && leaderId) {
      const member = await storage.getMember(Number(leaderId));
      if (member) {
        const hashedPassword = await bcrypt.hash(userPassword, 10);
        await storage.createUser({
          email: userEmail,
          password: hashedPassword,
          role: UserRoles.GROUP_PASTOR,
          firstName: member.fullName.split(' ')[0],
          lastName: member.fullName.split(' ').slice(1).join(' '),
          memberId: member.id,
          forcePasswordChange: true,
          groupId: group.id
        });
      }
    } else if (leaderId) {
      await storage.updateUser(leaderId, { role: UserRoles.GROUP_PASTOR, groupId: group.id });
    }
    res.status(201).json(group);
  });

  // PCFs: Admin or Group Pastor (within their group)
  app.post("/api/admin/pcfs", requireAuth, async (req, res) => {
    const role = req.user?.role;
    const { leaderId, groupId, createUser, userEmail, userPassword, userRole, ...pcfData } = req.body;
    
    if (role === UserRoles.ADMIN) {
      // Admin can create anywhere
    } else if (role === UserRoles.GROUP_PASTOR) {
      // Group Pastor can only create PCFs in their own group
      if (req.user?.groupId !== groupId) {
        return res.status(403).json({ message: "You can only create PCFs in your own group" });
      }
    } else {
      return res.status(403).json({ message: "You do not have permission to create PCFs" });
    }
    
    // Validate user creation data if requested
    if (createUser) {
      if (!userEmail || !userPassword) {
        return res.status(400).json({ message: "Email and password are required for user creation" });
      }
      
      const existingUser = await storage.getUserByEmail(userEmail);
      if (existingUser) {
        return res.status(400).json({ message: "Email already in use" });
      }

      if (leaderId) {
        const existingUserByMember = await storage.getUserByMemberId(Number(leaderId));
        if (existingUserByMember) {
          return res.status(400).json({ message: "This member already has a user account" });
        }
      }

      // Restrict role assignment
      if (role === UserRoles.GROUP_PASTOR && userRole === UserRoles.ADMIN) {
        return res.status(403).json({ message: "Group Pastors cannot assign Admin role" });
      }
    }
    
    // Validate leader assignment
    const leaderValidation = await validateLeaderAssignment(leaderId);
    if (!leaderValidation.valid) {
      return res.status(400).json({ message: leaderValidation.error });
    }
    
    const pcf = await storage.createPcf({ ...pcfData, groupId, leaderId });

    if (createUser && leaderId) {
      const member = await storage.getMember(Number(leaderId));
      if (member) {
        const hashedPassword = await bcrypt.hash(userPassword, 10);
        await storage.createUser({
          email: userEmail,
          password: hashedPassword,
          role: userRole || UserRoles.PCF_LEADER,
          firstName: member.fullName.split(' ')[0],
          lastName: member.fullName.split(' ').slice(1).join(' '),
          memberId: member.id,
          forcePasswordChange: true,
          groupId,
          pcfId: pcf.id
        });
      }
    } else if (leaderId) {
      await storage.updateUser(leaderId, { role: UserRoles.PCF_LEADER, pcfId: pcf.id, groupId });
    }
    res.status(201).json(pcf);
  });

  // Cells: Admin, Group Pastor (in their group), PCF Leader (in their PCF)
  app.post("/api/admin/cells", requireAuth, async (req, res) => {
    const role = req.user?.role;
    const { leaderId, pcfId, ...cellData } = req.body;
    
    if (role === UserRoles.ADMIN) {
      // Admin can create anywhere
    } else if (role === UserRoles.GROUP_PASTOR) {
      // Group Pastor can create cells in PCFs that belong to their group
      const accessiblePcfIds = await getAccessiblePcfIds(req.user!);
      if (!accessiblePcfIds.includes(pcfId)) {
        return res.status(403).json({ message: "You can only create cells in PCFs within your group" });
      }
    } else if (role === UserRoles.PCF_LEADER) {
      // PCF Leader can only create cells in their own PCF
      if (req.user?.pcfId !== pcfId) {
        return res.status(403).json({ message: "You can only create cells in your own PCF" });
      }
    } else {
      return res.status(403).json({ message: "You do not have permission to create cells" });
    }
    
    // Validate leader assignment
    const leaderValidation = await validateLeaderAssignment(leaderId);
    if (!leaderValidation.valid) {
      return res.status(400).json({ message: leaderValidation.error });
    }
    
    const cell = await storage.createCell({ ...cellData, pcfId, leaderId });
    if (leaderId) {
      await storage.updateUser(leaderId, { role: UserRoles.CELL_LEADER, cellId: cell.id, pcfId });
    }
    res.status(201).json(cell);
  });

  app.delete("/api/admin/groups/:id", requireAuth, requireRoles(UserRoles.ADMIN), async (req, res) => {
    await storage.deleteGroup(Number(req.params.id));
    res.status(204).send();
  });

  app.delete("/api/admin/pcfs/:id", requireAuth, requireRoles([UserRoles.ADMIN, UserRoles.GROUP_PASTOR] as any), async (req, res) => {
    await storage.deletePcf(Number(req.params.id));
    res.status(204).send();
  });

  app.delete("/api/admin/cells/:id", requireAuth, requireRoles([UserRoles.ADMIN, UserRoles.GROUP_PASTOR, UserRoles.PCF_LEADER] as any), async (req, res) => {
    await storage.deleteCell(Number(req.params.id));
    res.status(204).send();
  });

  app.post("/api/user/change-password", requireAuth, async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: "Both current and new passwords are required" });
      }

      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });

      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) {
        return res.status(400).json({ message: "Invalid current password" });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await storage.updateUser(user.id, { 
        password: hashedPassword,
        forcePasswordChange: false
      });

      res.json({ message: "Password updated successfully" });
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/admin/members/:id/convert", requireAuth, requireRoles([UserRoles.ADMIN, UserRoles.GROUP_PASTOR] as any), async (req, res) => {
    try {
      const memberId = Number(req.params.id);
      const { email, password, role } = req.body;
      
      const member = await storage.getMember(memberId);
      if (!member) return res.status(404).json({ message: "Member not found" });

      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) return res.status(400).json({ message: "Email already in use" });

      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await storage.createUser({
        email,
        password: hashedPassword,
        role,
        firstName: member.fullName.split(' ')[0],
        lastName: member.fullName.split(' ').slice(1).join(' '),
        memberId: member.id,
        forcePasswordChange: true,
      });

      res.status(201).json(user);
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // === SEED DATA ===
  // Seed data disabled to maintain clean production state
  // await seedData();

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
