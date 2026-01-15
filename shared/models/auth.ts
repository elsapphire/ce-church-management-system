import { sql } from "drizzle-orm";
import { index, integer, jsonb, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Role types for RBAC
export const UserRoles = {
  ADMIN: "admin",
  GROUP_PASTOR: "group_pastor",
  PCF_LEADER: "pcf_leader",
  CELL_LEADER: "cell_leader",
} as const;

export type UserRole = typeof UserRoles[keyof typeof UserRoles];

// Session storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)]
);

// User storage table with role-based scoping.
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  username: varchar("username"),
  password: varchar("password"),
  role: varchar("role").default("member"),
  title: varchar("title"),
  profileImageUrl: varchar("profile_image_url"),
  churchId: integer("church_id"),
  groupId: integer("group_id"),
  pcfId: integer("pcf_id"),
  cellId: integer("cell_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

// Login schema for validation
export const loginSchema = z.object({
  identifier: z.string().min(1, "Email or username is required"),
  password: z.string().min(1, "Password is required"),
});

export type LoginInput = z.infer<typeof loginSchema>;

// Insert user schema for registration
export const insertUserSchema = createInsertSchema(users).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});

export type InsertUser = z.infer<typeof insertUserSchema>;
