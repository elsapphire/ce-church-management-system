import { db } from "./db";
import { users, type User, loginSchema, type LoginInput } from "@shared/models/auth";
import { eq, or } from "drizzle-orm";
import bcrypt from "bcrypt";
import { Request, Response, NextFunction, Express } from "express";
import session from "express-session";
import connectPg from "connect-pg-simple";

const SALT_ROUNDS = 10;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

export async function findUserByEmailOrUsername(identifier: string): Promise<User | undefined> {
  const [user] = await db
    .select()
    .from(users)
    .where(or(eq(users.email, identifier), eq(users.username, identifier)));
  return user;
}

export async function createUser(userData: {
  email: string;
  username: string;
  password: string;
  firstName?: string;
  lastName?: string;
  role?: string;
  churchId?: number;
  groupId?: number;
  pcfId?: number;
  cellId?: number;
}): Promise<User> {
  const hashedPassword = await hashPassword(userData.password);
  const [user] = await db
    .insert(users)
    .values({
      ...userData,
      password: hashedPassword,
    })
    .returning();
  return user;
}

export async function updateUserPassword(userId: string, newPassword: string): Promise<void> {
  const hashedPassword = await hashPassword(newPassword);
  await db.update(users).set({ password: hashedPassword, updatedAt: new Date() }).where(eq(users.id, userId));
}

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  return session({
    secret: process.env.SESSION_SECRET || "church-cms-secret-key-change-in-production",
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: sessionTtl,
      sameSite: "lax",
    },
  });
}

declare module "express-session" {
  interface SessionData {
    userId: string;
  }
}

export async function isAuthenticated(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
}

export function setupLocalAuth(app: Express) {
  app.use(getSession());

  app.post("/api/auth/login", async (req, res) => {
    try {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ 
          message: parsed.error.errors[0]?.message || "Invalid input" 
        });
      }

      const { identifier, password } = parsed.data;

      const user = await findUserByEmailOrUsername(identifier);
      if (!user) {
        return res.status(401).json({ message: "Invalid email/username or password" });
      }

      if (!user.password) {
        return res.status(401).json({ message: "Password not set for this account" });
      }

      const isValid = await verifyPassword(password, user.password);
      if (!isValid) {
        return res.status(401).json({ message: "Invalid email/username or password" });
      }

      req.session.userId = user.id;

      const { password: _, ...userWithoutPassword } = user;
      res.json({ user: userWithoutPassword });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "An error occurred during login" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Failed to logout" });
      }
      res.clearCookie("connect.sid");
      res.json({ message: "Logged out successfully" });
    });
  });

  app.get("/api/auth/user", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const [user] = await db.select().from(users).where(eq(users.id, req.session.userId));
    if (!user) {
      req.session.destroy(() => {});
      return res.status(401).json({ message: "User not found" });
    }

    const { password: _, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);
  });
}

export async function seedDummyUsers() {
  const dummyUsers = [
    {
      email: "admin@church.org",
      username: "admin",
      password: "admin123",
      firstName: "Zonal",
      lastName: "Pastor",
      role: "admin",
      churchId: 1,
    },
    {
      email: "grouppastor@church.org",
      username: "grouppastor",
      password: "group123",
      firstName: "Group",
      lastName: "Pastor",
      role: "group_pastor",
      churchId: 1,
      groupId: 1,
    },
    {
      email: "pcfleader@church.org",
      username: "pcfleader",
      password: "pcf123",
      firstName: "PCF",
      lastName: "Leader",
      role: "pcf_leader",
      churchId: 1,
      groupId: 1,
      pcfId: 1,
    },
    {
      email: "cellleader@church.org",
      username: "cellleader",
      password: "cell123",
      firstName: "Cell",
      lastName: "Leader",
      role: "cell_leader",
      churchId: 1,
      groupId: 1,
      pcfId: 1,
      cellId: 1,
    },
  ];

  for (const userData of dummyUsers) {
    const existing = await findUserByEmailOrUsername(userData.email);
    if (!existing) {
      console.log(`Creating ${userData.role} user: ${userData.email}...`);
      await createUser(userData);
      console.log(`Created: ${userData.email} / ${userData.password}`);
    }
  }
}
