import { Request, Response, NextFunction } from "express";
import { db } from "./db";
import { users, UserRoles, type User as DbUser } from "@shared/models/auth";
import { groups, pcfs, cells } from "@shared/schema";
import { eq, inArray } from "drizzle-orm";

declare global {
  namespace Express {
    interface User extends DbUser {}
  }
}

export async function loadUser(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return next();
  }

  const [user] = await db.select().from(users).where(eq(users.id, req.session.userId));
  if (user) {
    req.user = user;
  }
  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ message: "Authentication required" });
  }
  next();
}

export function requireRoles(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: "Authentication required" });
    }

    if (!allowedRoles.includes(req.user.role || "")) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }

    next();
  };
}

export function canMarkAttendance(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ message: "Authentication required" });
  }

  const role = req.user.role;
  const allowedRoles = [UserRoles.ADMIN, UserRoles.GROUP_PASTOR];
  if (!allowedRoles.includes(role as string)) {
    return res.status(403).json({ message: "Only Zonal Pastor and Group Pastor can mark attendance" });
  }

  next();
}

export async function getAccessibleGroupIds(user: DbUser): Promise<number[]> {
  const role = user.role;

  if (role === UserRoles.ADMIN) {
    const allGroups = await db.select({ id: groups.id }).from(groups);
    return allGroups.map(g => g.id);
  }

  if (role === UserRoles.GROUP_PASTOR && user.groupId) {
    return [user.groupId];
  }

  if (role === UserRoles.PCF_LEADER && user.pcfId) {
    const [pcf] = await db.select({ groupId: pcfs.groupId }).from(pcfs).where(eq(pcfs.id, user.pcfId));
    return pcf ? [pcf.groupId] : [];
  }

  if (role === UserRoles.CELL_LEADER && user.cellId) {
    const [cell] = await db.select({ pcfId: cells.pcfId }).from(cells).where(eq(cells.id, user.cellId));
    if (!cell) return [];
    const [pcf] = await db.select({ groupId: pcfs.groupId }).from(pcfs).where(eq(pcfs.id, cell.pcfId));
    return pcf ? [pcf.groupId] : [];
  }

  return [];
}

export async function getAccessiblePcfIds(user: DbUser): Promise<number[]> {
  const role = user.role;

  if (role === UserRoles.ADMIN) {
    const allPcfs = await db.select({ id: pcfs.id }).from(pcfs);
    return allPcfs.map(p => p.id);
  }

  if (role === UserRoles.GROUP_PASTOR && user.groupId) {
    const groupPcfs = await db.select({ id: pcfs.id }).from(pcfs).where(eq(pcfs.groupId, user.groupId));
    return groupPcfs.map(p => p.id);
  }

  if (role === UserRoles.PCF_LEADER && user.pcfId) {
    return [user.pcfId];
  }

  if (role === UserRoles.CELL_LEADER && user.cellId) {
    const [cell] = await db.select({ pcfId: cells.pcfId }).from(cells).where(eq(cells.id, user.cellId));
    return cell ? [cell.pcfId] : [];
  }

  return [];
}

export async function getAccessibleCellIds(user: DbUser): Promise<number[]> {
  const role = user.role;

  if (role === UserRoles.ADMIN) {
    const allCells = await db.select({ id: cells.id }).from(cells);
    return allCells.map(c => c.id);
  }

  if (role === UserRoles.GROUP_PASTOR && user.groupId) {
    const groupPcfs = await db.select({ id: pcfs.id }).from(pcfs).where(eq(pcfs.groupId, user.groupId));
    if (groupPcfs.length === 0) return [];
    const pcfIds = groupPcfs.map(p => p.id);
    const groupCells = await db.select({ id: cells.id }).from(cells).where(inArray(cells.pcfId, pcfIds));
    return groupCells.map(c => c.id);
  }

  if (role === UserRoles.PCF_LEADER && user.pcfId) {
    const pcfCells = await db.select({ id: cells.id }).from(cells).where(eq(cells.pcfId, user.pcfId));
    return pcfCells.map(c => c.id);
  }

  if (role === UserRoles.CELL_LEADER && user.cellId) {
    return [user.cellId];
  }

  return [];
}

export async function getAccessibleMemberFilter(user: DbUser): Promise<number[] | null> {
  const cellIds = await getAccessibleCellIds(user);
  if (cellIds.length === 0 && user.role !== UserRoles.ADMIN) {
    return [];
  }
  return user.role === UserRoles.ADMIN ? null : cellIds;
}
