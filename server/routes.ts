import bcrypt from "bcrypt";
import crypto from "crypto";
import type { Express } from "express";
import type { Server } from "http";
import { setupLocalAuth, seedDummyUsers } from "./auth";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { loadUser, requireAuth, canMarkAttendance, getAccessibleCellIds, getAccessiblePcfIds, requireRoles } from "./rbac";
import { UserRoles, type UserRole } from "@shared/models/auth";
import { pcfs, cells } from "@shared/schema";

// Helper to detect if a string is a UUID
function isUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

// Helper to resolve leader: accepts user UUID or member ID, returns user (creating if needed)
async function resolveLeaderUser(leaderId: string | number | null | undefined): Promise<{ 
  userId: string | null; 
  user: any | null;
  isNewUser: boolean;
  tempPassword: string | null;
  email: string | null;
}> {
  if (!leaderId) {
    return { userId: null, user: null, isNewUser: false, tempPassword: null, email: null };
  }
  
  const leaderIdStr = String(leaderId);
  
  // Check if it's a UUID (user ID)
  if (isUUID(leaderIdStr)) {
    const user = await storage.getUser(leaderIdStr);
    if (user) {
      return { userId: user.id, user, isNewUser: false, tempPassword: null, email: user.email };
    }
    // UUID but no user found - invalid
    return { userId: null, user: null, isNewUser: false, tempPassword: null, email: null };
  }
  
  // Not a UUID - treat as member ID
  const memberId = Number(leaderId);
  if (isNaN(memberId)) {
    return { userId: null, user: null, isNewUser: false, tempPassword: null, email: null };
  }
  
  // Check if member has an existing user account
  const existingUser = await storage.getUserByMemberId(memberId);
  if (existingUser) {
    return { userId: existingUser.id, user: existingUser, isNewUser: false, tempPassword: null, email: existingUser.email };
  }
  
  // No user exists - create one from member data
  const member = await storage.getMember(memberId);
  if (!member) {
    return { userId: null, user: null, isNewUser: false, tempPassword: null, email: null };
  }
  
  // Generate temporary password
  const tempPassword = crypto.randomBytes(16).toString("base64url");
  const hashedPassword = await bcrypt.hash(tempPassword, 10);
  
  // Use member's email or generate a placeholder if missing
  const email = member.email || `member_${member.id}@temp.local`;
  
  // Check if email is already in use
  const existingByEmail = await storage.getUserByEmail(email);
  if (existingByEmail) {
    // Email conflict - use the existing user
    return { userId: existingByEmail.id, user: existingByEmail, isNewUser: false, tempPassword: null, email: existingByEmail.email };
  }
  
  // Create new user from member
  const newUser = await storage.createUser({
    email,
    password: hashedPassword,
    role: UserRoles.MEMBER as UserRole,
    firstName: member.fullName.split(' ')[0],
    lastName: member.fullName.split(' ').slice(1).join(' ') || '',
    memberId: member.id,
    forcePasswordChange: true
  });
  
  console.log(`Auto-created user for member ${member.id} (${member.fullName}) with email: ${email}, tempPassword: ${tempPassword}`);
  
  return { userId: newUser.id, user: newUser, isNewUser: true, tempPassword, email };
}

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

    return res.json({
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
    return res.json(filteredMembers);
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
    
    return res.json(member);
  });

  app.post(api.members.create.path, requireAuth, async (req, res) => {
    try {
      console.log("POST /api/members body:", req.body);
      const input = api.members.create.input.parse({
        ...req.body,
        email: req.body.email?.trim() || null
      });
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
      return res.status(201).json(member);
    } catch (err: any) {
      console.error("Member creation error detail:", err);
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ') });
      }
      if (err.message === "A member with this email already exists") {
        return res.status(400).json({ message: err.message });
      }
      console.error("Member creation error:", err);
      return res.status(500).json({ message: "An internal server error occurred" });
    }
  });

  app.put(api.members.update.path, requireAuth, async (req, res) => {
    try {
        const input = api.members.update.input.parse({
          ...req.body,
          email: req.body.email?.trim() || null
        });
        const member = await storage.updateMember(Number(req.params.id), input);
        return res.json(member);
    } catch (err: any) {
        if (err.message === "A member with this email already exists") {
          return res.status(400).json({ message: err.message });
        }
        return res.status(400).json({ message: "Invalid update" });
    }
  });

  app.delete(api.members.delete.path, requireAuth, async (req, res) => {
    await storage.deleteMember(Number(req.params.id));
    return res.status(204).send();
  });

  // === SERVICES ===
  app.get(api.services.list.path, requireAuth, async (req, res) => {
    const services = await storage.getServices();
    return res.json(services);
  });

  app.post(api.services.create.path, requireAuth, async (req, res) => {
    try {
        const input = api.services.create.input.parse(req.body);
        const service = await storage.createService(input);
        return res.status(201).json(service);
    } catch (err: any) {
        if (err instanceof z.ZodError) {
          return res.status(400).json({ message: err.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ') });
        }
        console.error("Service creation error:", err);
        return res.status(400).json({ message: "Invalid service data" });
    }
  });

  app.patch(api.services.update.path, requireAuth, async (req, res) => {
    try {
        const input = api.services.update.input.parse(req.body);
        const service = await storage.updateService(Number(req.params.id), input);
        return res.json(service);
    } catch (err) {
        return res.status(400).json({ message: "Invalid update" });
    }
  });

  // === ATTENDANCE ===
  app.post(api.attendance.mark.path, canMarkAttendance, async (req, res) => {
    try {
        const input = api.attendance.mark.input.parse(req.body);
        const record = await storage.markAttendance(input);
        return res.status(201).json(record);
    } catch (err) {
        return res.status(400).json({ message: "Invalid attendance data" });
    }
  });

  app.get(api.attendance.list.path, requireAuth, async (req, res) => {
    const serviceId = Number(req.query.serviceId);
    if (!serviceId) return res.status(400).json({ message: "serviceId required" });
    const records = await storage.getAttendanceForService(serviceId);
    return res.json(records);
  });

  app.get(api.attendance.stats.path, requireAuth, async (req, res) => {
    const serviceId = req.query.serviceId ? Number(req.query.serviceId) : undefined;
    const stats = await storage.getAttendanceStats(serviceId);
    return res.json(stats);
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
    return res.json(safeUsers);
  });

  // Structure: Leader selection validation (REMOVED generic check)

  // Groups: Admin only
  app.post("/api/admin/groups", requireAuth, async (req, res) => {
    if (req.user?.role !== UserRoles.ADMIN) {
      return res.status(403).json({ message: "Only Zonal Pastor can create groups" });
    }
    const { leaderId, memberId, createUser, userEmail, userPassword, userRole, ...groupData } = req.body;
    
    let assignedLeaderId = leaderId;

    // Handle Idempotent User Management
    if (memberId) {
      const existingUserByMember = await storage.getUserByMemberId(Number(memberId));
      const existingUserByEmail = userEmail ? await storage.getUserByEmail(userEmail) : null;
      const user = existingUserByMember || existingUserByEmail;

      if (user) {
        assignedLeaderId = user.id;
        // Check for specific group conflict
        if (user.groupId && user.role === UserRoles.GROUP_PASTOR) {
          // If trying to assign to a DIFFERENT group than they already have, we might allow it 
          // but the prompt says: "Block ONLY if user is already Group Pastor of the SAME group."
          // Since we are CREATING a group here, they can't be assigned to this specific group yet.
          // However, if they are ALREADY a group pastor of SOME group, we should probably allow it
          // based on "Users ARE allowed to hold multiple leadership roles across different levels."
        }
      } else if (createUser) {
        if (!userEmail || !userPassword) {
          return res.status(400).json({ message: "Email and password are required for user creation" });
        }
        
        const member = await storage.getMember(Number(memberId));
        if (!member) {
          return res.status(404).json({ message: "Selected member not found" });
        }

        const hashedPassword = await bcrypt.hash(userPassword, 10);
        const newUser = await storage.createUser({
          email: userEmail,
          password: hashedPassword,
          role: UserRoles.GROUP_PASTOR,
          firstName: member.fullName.split(' ')[0],
          lastName: member.fullName.split(' ').slice(1).join(' '),
          memberId: member.id,
          forcePasswordChange: true
        });
        assignedLeaderId = newUser.id;
      }
    }
    
    // Create Group
    const group = await storage.createGroup({ ...groupData, leaderId: assignedLeaderId });

    // Update user linkage and role
    if (assignedLeaderId) {
      await storage.updateUser(assignedLeaderId, { 
        role: UserRoles.GROUP_PASTOR, 
        groupId: group.id,
        memberId: memberId ? Number(memberId) : undefined 
      });
    }

    return res.status(201).json(group);
  });

  // PCFs: Admin or Group Pastor (within their group)
  app.post("/api/admin/pcfs", requireAuth, async (req, res) => {
    const role = req.user?.role;
    const { leaderId, memberId, groupId, createUser, userEmail, userPassword, userRole, ...pcfData } = req.body;
    
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
    
    let assignedLeaderId = leaderId;

    // Handle Idempotent User Management
    if (memberId) {
      const existingUserByMember = await storage.getUserByMemberId(Number(memberId));
      const existingUserByEmail = userEmail ? await storage.getUserByEmail(userEmail) : null;
      const user = existingUserByMember || existingUserByEmail;

      if (user) {
        assignedLeaderId = user.id;
      } else if (createUser) {
        if (!userEmail || !userPassword) {
          return res.status(400).json({ message: "Email and password are required for user creation" });
        }
        
        const member = await storage.getMember(Number(memberId));
        if (!member) {
          return res.status(404).json({ message: "Selected member not found" });
        }

        const hashedPassword = await bcrypt.hash(userPassword, 10);
        const newUser = await storage.createUser({
          email: userEmail,
          password: hashedPassword,
          role: userRole || UserRoles.PCF_LEADER,
          firstName: member.fullName.split(' ')[0],
          lastName: member.fullName.split(' ').slice(1).join(' '),
          memberId: member.id,
          forcePasswordChange: true
        });
        assignedLeaderId = newUser.id;
      }
    }
    
    // Create PCF
    const pcf = await storage.createPcf({ ...pcfData, groupId, leaderId: assignedLeaderId });

    // Update user linkage
    if (assignedLeaderId) {
      await storage.updateUser(assignedLeaderId, { 
        role: userRole || UserRoles.PCF_LEADER, 
        pcfId: pcf.id, 
        groupId,
        memberId: memberId ? Number(memberId) : undefined
      });
    }

    return res.status(201).json(pcf);
  });

  // Cells: Admin, Group Pastor (in their group), PCF Leader (in their PCF)
  app.post("/api/admin/cells", requireAuth, async (req, res) => {
    const role = req.user?.role;
    const { leaderId, memberId, pcfId, ...cellData } = req.body;
    
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
    
    let assignedLeaderId = leaderId;
    if (memberId && !assignedLeaderId) {
      const user = await storage.getUserByMemberId(Number(memberId));
      if (user) assignedLeaderId = user.id;
    }

    const cell = await storage.createCell({ ...cellData, pcfId, leaderId: assignedLeaderId });
    if (assignedLeaderId) {
      await storage.updateUser(assignedLeaderId, { 
        role: UserRoles.CELL_LEADER, 
        cellId: cell.id, 
        pcfId,
        memberId: memberId ? Number(memberId) : undefined
      });
    }
    return res.status(201).json(cell);
  });

  app.delete("/api/admin/groups/:id", requireAuth, requireRoles(UserRoles.ADMIN), async (req, res) => {
    await storage.deleteGroup(Number(req.params.id));
    return res.status(204).send();
  });

  app.delete("/api/admin/pcfs/:id", requireAuth, async (req, res) => {
    const role = req.user?.role;
    if (role !== UserRoles.ADMIN && role !== UserRoles.GROUP_PASTOR) {
      return res.status(403).json({ message: "Only Zonal Pastor and Group Pastor can delete PCFs" });
    }
    
    const pcf = await storage.getPcf(Number(req.params.id));
    if (role === UserRoles.GROUP_PASTOR) {
      if (!pcf || pcf.groupId !== req.user?.groupId) {
        return res.status(403).json({ message: "You can only delete PCFs in your own group" });
      }
    }

    await storage.deletePcf(Number(req.params.id));
    return res.status(204).send();
  });

  app.delete("/api/admin/cells/:id", requireAuth, async (req, res) => {
    const role = req.user?.role;
    const allowedRoles = [UserRoles.ADMIN, UserRoles.GROUP_PASTOR, UserRoles.PCF_LEADER];
    if (!allowedRoles.includes(role as any)) {
      return res.status(403).json({ message: "Insufficient permissions to delete cells" });
    }

    const cell = await storage.getCell(Number(req.params.id));
    if (role === UserRoles.GROUP_PASTOR) {
      if (!cell) return res.status(404).json({ message: "Cell not found" });
      const pcf = await storage.getPcf(cell.pcfId);
      if (!pcf || pcf.groupId !== req.user?.groupId) {
        return res.status(403).json({ message: "You can only delete cells in your own group" });
      }
    } else if (role === UserRoles.PCF_LEADER) {
      if (!cell || cell.pcfId !== req.user?.pcfId) {
        return res.status(403).json({ message: "You can only delete cells in your own PCF" });
      }
    }

    await storage.deleteCell(Number(req.params.id));
    return res.status(204).send();
  });

  app.patch("/api/admin/groups/:id", requireAuth, requireRoles(UserRoles.ADMIN), async (req, res) => {
    const { leaderId, memberId, ...groupData } = req.body;
    const existingGroup = await storage.getGroup(Number(req.params.id));
    if (!existingGroup) return res.status(404).json({ message: "Group not found" });
    
    const oldLeaderId = existingGroup.leaderId || null;
    
    // Resolve leader: accepts user UUID or member ID, auto-creates user if needed
    const selectedLeaderId = leaderId || memberId;
    const { userId: newLeaderId, user: newLeaderUser, isNewUser, tempPassword, email } = await resolveLeaderUser(selectedLeaderId);
    
    // Step 1: Demote old leader if changed
    if (oldLeaderId && oldLeaderId !== newLeaderId) {
      const oldUser = await storage.getUser(oldLeaderId);
      if (oldUser && oldUser.role === UserRoles.GROUP_PASTOR) {
        await storage.updateUser(oldUser.id, { role: UserRoles.MEMBER as UserRole, groupId: null });
        if (oldUser.memberId) {
          await storage.updateMember(oldUser.memberId, { designation: "MEMBER" });
        }
      }
    }

    // Step 2: Update group with new leaderId
    const group = await storage.updateGroup(Number(req.params.id), { ...groupData, leaderId: newLeaderId });
    
    // Step 3: Promote new leader
    if (newLeaderId && newLeaderUser) {
      await storage.updateUser(newLeaderId, { role: UserRoles.GROUP_PASTOR, groupId: group.id });
      if (newLeaderUser.memberId) {
        await storage.updateMember(newLeaderUser.memberId, { designation: "GROUP_PASTOR" });
      }
    }
    
    // Include credentials if a new user was auto-created
    const response: any = { ...group };
    if (isNewUser && tempPassword) {
      response.newLeaderCredentials = { email, tempPassword, mustChangePassword: true };
    }
    
    return res.json(response);
  });

  app.patch("/api/admin/pcfs/:id", requireAuth, async (req, res) => {
    const role = req.user?.role;
    if (role !== UserRoles.ADMIN && role !== UserRoles.GROUP_PASTOR) {
      return res.status(403).json({ message: "Only Zonal Pastor and Group Pastor can edit PCFs" });
    }

    const pcfId = Number(req.params.id);
    const existingPcf = await storage.getPcf(pcfId);
    if (!existingPcf) return res.status(404).json({ message: "PCF not found" });

    if (role === UserRoles.GROUP_PASTOR) {
      if (existingPcf.groupId !== Number(req.user?.groupId)) {
        return res.status(403).json({ message: "You can only edit PCFs in your own group" });
      }
    }

    console.log('PCF EDIT BODY:', req.body);
    
    const { leaderId, memberId, ...pcfData } = req.body;
    const oldLeaderId = existingPcf.leaderId || null;
    
    // Resolve leader: accepts user UUID or member ID, auto-creates user if needed
    const selectedLeaderId = leaderId || memberId;
    const { userId: newLeaderId, user: newLeaderUser, isNewUser, tempPassword, email } = await resolveLeaderUser(selectedLeaderId);
    
    console.log('PCF EDIT - oldLeaderId:', oldLeaderId, 'newLeaderId:', newLeaderId);
    
    // Step 1: Demote old leader if changed
    if (oldLeaderId && oldLeaderId !== newLeaderId) {
      const oldUser = await storage.getUser(oldLeaderId);
      if (oldUser && oldUser.role === UserRoles.PCF_LEADER) {
        await storage.updateUser(oldUser.id, { role: UserRoles.MEMBER as UserRole, pcfId: null, groupId: null });
        if (oldUser.memberId) {
          await storage.updateMember(oldUser.memberId, { designation: "MEMBER" });
        }
      }
    }

    // Step 2: Update PCF with new leaderId (user UUID)
    const pcf = await storage.updatePcf(pcfId, { ...pcfData, leaderId: newLeaderId });

    // Step 3: Promote new leader
    if (newLeaderId && newLeaderUser) {
      await storage.updateUser(newLeaderId, { 
        role: UserRoles.PCF_LEADER, 
        pcfId: pcf.id,
        groupId: pcf.groupId 
      });
      if (newLeaderUser.memberId) {
        await storage.updateMember(newLeaderUser.memberId, { designation: "PCF_LEADER" });
      }
    }

    // Include credentials if a new user was auto-created
    const response: any = { ...pcf };
    if (isNewUser && tempPassword) {
      response.newLeaderCredentials = { email, tempPassword, mustChangePassword: true };
    }

    res.json(response);
  });

  app.patch("/api/admin/cells/:id", requireAuth, async (req, res) => {
    const role = req.user?.role;
    const allowedRoles = [UserRoles.ADMIN, UserRoles.GROUP_PASTOR, UserRoles.PCF_LEADER];
    if (!allowedRoles.includes(role as any)) {
      return res.status(403).json({ message: "Insufficient permissions to edit cells" });
    }

    const cellId = Number(req.params.id);
    const cellRecord = await storage.getCell(cellId);
    if (!cellRecord) return res.status(404).json({ message: "Cell not found" });

    if (role === UserRoles.GROUP_PASTOR) {
      const pcf = await storage.getPcf(cellRecord.pcfId);
      if (!pcf || pcf.groupId !== req.user?.groupId) {
        return res.status(403).json({ message: "You can only edit cells in your own group" });
      }
    } else if (role === UserRoles.PCF_LEADER) {
      if (cellRecord.pcfId !== req.user?.pcfId) {
        return res.status(403).json({ message: "You can only edit cells in your own PCF" });
      }
    }

    const { leaderId, memberId, ...cellData } = req.body;
    const oldLeaderId = cellRecord.leaderId || null;
    
    // Resolve leader: accepts user UUID or member ID, auto-creates user if needed
    const selectedLeaderId = leaderId || memberId;
    const { userId: newLeaderId, user: newLeaderUser, isNewUser, tempPassword, email } = await resolveLeaderUser(selectedLeaderId);
    
    // Step 1: Demote old leader if changed
    if (oldLeaderId && oldLeaderId !== newLeaderId) {
      const oldUser = await storage.getUser(oldLeaderId);
      if (oldUser && oldUser.role === UserRoles.CELL_LEADER) {
        await storage.updateUser(oldUser.id, { role: UserRoles.MEMBER as UserRole, cellId: null });
        if (oldUser.memberId) {
          await storage.updateMember(oldUser.memberId, { designation: "MEMBER" });
        }
      }
    }
    
    // Step 2: Update cell with new leaderId (user UUID)
    const updatedCell = await storage.updateCell(cellId, { ...cellData, leaderId: newLeaderId });
    
    // Step 3: Promote new leader
    if (newLeaderId && newLeaderUser) {
      const pcf = await storage.getPcf(updatedCell.pcfId);
      await storage.updateUser(newLeaderId, { 
        role: UserRoles.CELL_LEADER, 
        cellId: updatedCell.id,
        pcfId: updatedCell.pcfId,
        groupId: pcf?.groupId
      });
      if (newLeaderUser.memberId) {
        await storage.updateMember(newLeaderUser.memberId, { designation: "CELL_LEADER" });
      }
    }
    
    // Include credentials if a new user was auto-created
    const response: any = { ...updatedCell };
    if (isNewUser && tempPassword) {
      response.newLeaderCredentials = { email, tempPassword, mustChangePassword: true };
    }
    
    return res.json(response);
  });

  app.post("/api/user/change-password", requireAuth, async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: "Both current and new passwords are required" });
      }

      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      const user = await storage.getUser(String(userId));
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

      return res.json({ message: "Password updated successfully" });
    } catch (err) {
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/admin/members/:id/convert", requireAuth, requireRoles([UserRoles.ADMIN, UserRoles.GROUP_PASTOR] as any), async (req, res) => {
    try {
      const memberId = Number(req.params.id);
      const { email, password, role } = req.body;

      if (!email || !password || !role) {
        return res.status(400).json({ message: "Email, password, and role are required" });
      }

      // Restrict role assignment: Group Pastor cannot create Admin
      if (req.user?.role === UserRoles.GROUP_PASTOR && role === UserRoles.ADMIN) {
        return res.status(403).json({ message: "Group Pastors cannot assign Zonal Pastor role" });
      }
      
      const member = await storage.getMember(memberId);
      if (!member) return res.status(404).json({ message: "Member not found" });

      const existingUserByEmail = await storage.getUserByEmail(email);
      if (existingUserByEmail) return res.status(400).json({ message: "Email already in use" });

      const existingUserByMember = await storage.getUserByMemberId(memberId);
      if (existingUserByMember) return res.status(400).json({ message: "This member already has a user account" });

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

      return res.status(201).json(user);
    } catch (err) {
      return res.status(500).json({ message: "Internal server error" });
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
