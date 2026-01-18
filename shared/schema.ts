import { pgTable, text, serial, timestamp, boolean, integer, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";
import { users, sessions, UserRoles, type User, type InsertUser, type UserRole, type UpsertUser, insertUserSchema, loginSchema } from "./models/auth";

export { users, sessions, UserRoles, type User, type InsertUser, type UserRole, type UpsertUser, insertUserSchema, loginSchema };

// === CHURCH HIERARCHY ===
export const churches = pgTable("churches", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  address: text("address"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const groups = pgTable("groups", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  churchId: integer("church_id").references(() => churches.id).notNull(),
  leaderId: varchar("leader_id"),
});

export const pcfs = pgTable("pcfs", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  groupId: integer("group_id").references(() => groups.id).notNull(),
  leaderId: varchar("leader_id"),
});

export const cells = pgTable("cells", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  pcfId: integer("pcf_id").references(() => pcfs.id).notNull(),
  leaderId: varchar("leader_id"),
});

// === MEMBERS ===
export const members = pgTable("members", {
  id: serial("id").primaryKey(),
  fullName: text("full_name").notNull(),
  phone: text("phone"),
  email: text("email").unique(),
  gender: text("gender"), // Male, Female
  title: text("title"),
  designation: text("designation").default("MEMBER").notNull(), // MEMBER, CELL_LEADER, PCF_LEADER, GROUP_PASTOR, PASTORAL_ASSISTANT
  birthDay: integer("birth_day"), // 1-31
  birthMonth: integer("birth_month"), // 1-12
  photoUrl: text("photo_url"),
  status: text("status").default("Active"), // Active, Inactive
  biometricTemplate: text("biometric_template"), // Future use
  cellId: integer("cell_id").references(() => cells.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// === SERVICES ===
export const services = pgTable("services", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(), // Sunday Service, Midweek Service
  date: timestamp("date").notNull(),
  startTime: text("start_time").notNull(), // HH:MM
  endTime: text("end_time").notNull(),   // HH:MM
  price: integer("price").default(0),
  costToDeliver: integer("cost_to_deliver").default(0),
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// === ATTENDANCE ===
export const attendanceRecords = pgTable("attendance_records", {
  id: serial("id").primaryKey(),
  memberId: integer("member_id").references(() => members.id).notNull(),
  serviceId: integer("service_id").references(() => services.id).notNull(),
  checkInTime: timestamp("check_in_time").defaultNow(),
  method: text("method").notNull(), // fingerprint, qr_code, manual
  deviceId: text("device_id"),
  location: text("location"),
});

// === RELATIONS ===
export const groupsRelations = relations(groups, ({ one, many }) => ({
  church: one(churches, { fields: [groups.churchId], references: [churches.id] }),
  pcfs: many(pcfs),
}));

export const pcfsRelations = relations(pcfs, ({ one, many }) => ({
  group: one(groups, { fields: [pcfs.groupId], references: [groups.id] }),
  cells: many(cells),
}));

export const cellsRelations = relations(cells, ({ one, many }) => ({
  pcf: one(pcfs, { fields: [cells.pcfId], references: [pcfs.id] }),
  members: many(members),
}));

export const membersRelations = relations(members, ({ one, many }) => ({
  cell: one(cells, { fields: [members.cellId], references: [cells.id] }),
  user: one(users, { fields: [members.id], references: [users.memberId] }),
  attendance: many(attendanceRecords),
}));

export const usersRelations = relations(users, ({ one }) => ({
  member: one(members, { fields: [users.memberId], references: [members.id] }),
}));

export const servicesRelations = relations(services, ({ many }) => ({
  attendance: many(attendanceRecords),
}));

export const attendanceRelations = relations(attendanceRecords, ({ one }) => ({
  member: one(members, { fields: [attendanceRecords.memberId], references: [members.id] }),
  service: one(services, { fields: [attendanceRecords.serviceId], references: [services.id] }),
}));

// === INFERRED TYPES ===
export type Church = typeof churches.$inferSelect;
export type Group = typeof groups.$inferSelect;
export type Pcf = typeof pcfs.$inferSelect;
export type Cell = typeof cells.$inferSelect;
export type Member = typeof members.$inferSelect;
export type Service = typeof services.$inferSelect;
export type AttendanceRecord = typeof attendanceRecords.$inferSelect;

export const insertMemberSchema = createInsertSchema(members).omit({ id: true, createdAt: true });
export const insertServiceSchema = createInsertSchema(services).omit({ id: true, createdAt: true });
export const insertAttendanceSchema = createInsertSchema(attendanceRecords).omit({ id: true, checkInTime: true });
export const insertGroupSchema = createInsertSchema(groups).omit({ id: true });
export const insertPcfSchema = createInsertSchema(pcfs).omit({ id: true });
export const insertCellSchema = createInsertSchema(cells).omit({ id: true });

export type InsertMember = z.infer<typeof insertMemberSchema>;
export type InsertService = z.infer<typeof insertServiceSchema>;
export type InsertAttendance = z.infer<typeof insertAttendanceSchema>;
export type InsertGroup = z.infer<typeof insertGroupSchema>;
export type InsertPcf = z.infer<typeof insertPcfSchema>;
export type InsertCell = z.infer<typeof insertCellSchema>;

// === REPORT TYPES ===
export type AttendanceStats = {
  serviceId: number;
  serviceName: string;
  totalPresent: number;
  byMethod: Record<string, number>;
};
