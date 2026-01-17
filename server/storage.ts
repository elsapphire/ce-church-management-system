import { db } from "./db";
import {
  users, members, services, attendanceRecords, churches, groups, pcfs, cells,
  type User, type InsertUser,
  type Member, type InsertMember,
  type Service, type InsertService,
  type AttendanceRecord, type InsertAttendance,
  type Church, type Group, type Pcf, type Cell
} from "@shared/schema";
import { eq, desc, and, sql } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByMemberId(memberId: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  updateUser(id: string, updates: Partial<User>): Promise<User>;
  
  // Hierarchy
  getChurch(): Promise<Church | undefined>;
  createChurch(name: string, address: string): Promise<Church>;
  getGroups(churchId: number): Promise<Group[]>;
  createGroup(group: any): Promise<Group>;
  getPcfs(groupId: number): Promise<Pcf[]>;
  createPcf(pcf: any): Promise<Pcf>;
  getCells(pcfId: number): Promise<Cell[]>;
  getAllCells(): Promise<Cell[]>; // Helper
  createCell(cell: any): Promise<Cell>;
  deleteGroup(id: number): Promise<void>;
  deletePcf(id: number): Promise<void>;
  deleteCell(id: number): Promise<void>;
  createUser(user: InsertUser): Promise<User>;

  // Members
  getMembers(): Promise<Member[]>;
  getMember(id: number): Promise<Member | undefined>;
  createMember(member: InsertMember): Promise<Member>;
  updateMember(id: number, member: Partial<InsertMember>): Promise<Member>;
  deleteMember(id: number): Promise<void>;

  // Services
  getServices(): Promise<Service[]>;
  getService(id: number): Promise<Service | undefined>;
  createService(service: InsertService): Promise<Service>;
  updateService(id: number, service: Partial<InsertService>): Promise<Service>;

  // Attendance
  markAttendance(attendance: InsertAttendance): Promise<AttendanceRecord>;
  getAttendanceForService(serviceId: number): Promise<(AttendanceRecord & { member: Member })[]>;
  getAttendanceStats(serviceId?: number): Promise<any[]>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByMemberId(memberId: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.memberId, memberId));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return db.select().from(users);
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User> {
    const [updated] = await db.update(users).set(updates).where(eq(users.id, id)).returning();
    return updated;
  }

  // Hierarchy
  async getChurch(): Promise<Church | undefined> {
    const [church] = await db.select().from(churches).limit(1);
    return church;
  }

  async createChurch(name: string, address: string): Promise<Church> {
    const [church] = await db.insert(churches).values({ name, address }).returning();
    return church;
  }

  async getGroups(churchId: number): Promise<Group[]> {
    return db.select().from(groups).where(eq(groups.churchId, churchId));
  }

  async createGroup(group: any): Promise<Group> {
    const [g] = await db.insert(groups).values(group).returning();
    return g;
  }

  async getPcfs(groupId: number): Promise<Pcf[]> {
    return db.select().from(pcfs).where(eq(pcfs.groupId, groupId));
  }

  async createPcf(pcf: any): Promise<Pcf> {
    const [p] = await db.insert(pcfs).values(pcf).returning();
    return p;
  }

  async getCells(pcfId: number): Promise<Cell[]> {
    return db.select().from(cells).where(eq(cells.pcfId, pcfId));
  }

  async getAllCells(): Promise<Cell[]> {
    return db.select().from(cells);
  }

  async createCell(cell: any): Promise<Cell> {
    const [c] = await db.insert(cells).values(cell).returning();
    return c;
  }

  async deleteGroup(id: number): Promise<void> {
    await db.delete(groups).where(eq(groups.id, id));
  }

  async deletePcf(id: number): Promise<void> {
    await db.delete(pcfs).where(eq(pcfs.id, id));
  }

  async deleteCell(id: number): Promise<void> {
    await db.delete(cells).where(eq(cells.id, id));
  }

  async createUser(user: InsertUser): Promise<User> {
    const [u] = await db.insert(users).values(user).returning();
    return u;
  }

  // Members
  async getMembers(): Promise<Member[]> {
    return db.select().from(members).orderBy(desc(members.createdAt));
  }

  async getMember(id: number): Promise<Member | undefined> {
    const [member] = await db.select().from(members).where(eq(members.id, id));
    return member;
  }

  async createMember(member: InsertMember): Promise<Member> {
    const [m] = await db.insert(members).values(member).returning();
    return m;
  }

  async updateMember(id: number, updates: Partial<InsertMember>): Promise<Member> {
    const [updated] = await db.update(members).set(updates).where(eq(members.id, id)).returning();
    return updated;
  }

  async deleteMember(id: number): Promise<void> {
    await db.delete(members).where(eq(members.id, id));
  }

  // Services
  async getServices(): Promise<Service[]> {
    return db.select().from(services).orderBy(desc(services.date));
  }

  async getService(id: number): Promise<Service | undefined> {
    const [service] = await db.select().from(services).where(eq(services.id, id));
    return service;
  }

  async createService(service: InsertService): Promise<Service> {
    const [s] = await db.insert(services).values(service).returning();
    return s;
  }

  async updateService(id: number, updates: Partial<InsertService>): Promise<Service> {
    const [updated] = await db.update(services).set(updates).where(eq(services.id, id)).returning();
    return updated;
  }

  // Attendance
  async markAttendance(attendance: InsertAttendance): Promise<AttendanceRecord> {
    // Check duplicate
    const [existing] = await db.select().from(attendanceRecords).where(
      and(
        eq(attendanceRecords.memberId, attendance.memberId),
        eq(attendanceRecords.serviceId, attendance.serviceId)
      )
    );
    if (existing) return existing;

    const [record] = await db.insert(attendanceRecords).values(attendance).returning();
    return record;
  }

  async getAttendanceForService(serviceId: number): Promise<(AttendanceRecord & { member: Member })[]> {
    const records = await db.select({
      attendance: attendanceRecords,
      member: members,
    })
    .from(attendanceRecords)
    .innerJoin(members, eq(attendanceRecords.memberId, members.id))
    .where(eq(attendanceRecords.serviceId, serviceId));

    return records.map(r => ({ ...r.attendance, member: r.member }));
  }

  async getAttendanceStats(serviceId?: number): Promise<any[]> {
    // Basic implementation - aggregate in memory or simple query
    // For now, let's get all services and compute stats
    const allServices = serviceId 
      ? [await this.getService(serviceId)]
      : await this.getServices();
    
    const results = [];
    for (const s of allServices) {
      if (!s) continue;
      const records = await this.getAttendanceForService(s.id);
      
      const byMethod = records.reduce((acc, curr) => {
        acc[curr.method] = (acc[curr.method] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const byCell = records.reduce((acc, curr) => {
        const cellId = curr.member.cellId || 0;
        acc[cellId] = (acc[cellId] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      results.push({
        serviceId: s.id,
        serviceName: s.name,
        totalPresent: records.length,
        byMethod,
        byCell
      });
    }
    return results;
  }
}

export const storage = new DatabaseStorage();
