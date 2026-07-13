import { Express, Request, Response, NextFunction } from "express";
import session from "express-session";
import connectPg from "connect-pg-simple";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { pool } from "./db";
import { storage } from "./storage";
import { User } from "@shared/schema";

const scryptAsync = promisify(scrypt);
const PgSession = connectPg(session);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedPasswordBuf = Buffer.from(hashed, "hex");
  const suppliedPasswordBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedPasswordBuf, suppliedPasswordBuf);
}

const INACTIVITY_LIMIT_MS = 25 * 60 * 1000; // 25 minutes

// Paths that are background polls — must NOT reset the activity timer
const POLLING_PATHS = new Set([
  "/api/institutional-transfers",
  "/api/market/quote",
]);

function isPollingRequest(req: Request): boolean {
  return POLLING_PATHS.has(req.path) ||
    req.path.startsWith("/api/market/");
}

export function setupAuth(app: Express) {
  const sessionSettings: session.SessionOptions = {
    store: new PgSession({ 
      pool, 
      createTableIfMissing: true, 
      tableName: 'session'
    }),
    secret: process.env.SESSION_SECRET || "default_secret",
    resave: true,
    saveUninitialized: false,
    rolling: false,
    proxy: true,
    cookie: {
      maxAge: 8 * 60 * 60 * 1000, // 8-hour browser cookie backstop
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      httpOnly: true,
      path: "/",
    },
  };

  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  // Track genuine user activity — skip background polling requests
  app.use((req: Request, _res: Response, next: NextFunction) => {
    if (req.session && (req.session as any).passport?.user && !isPollingRequest(req)) {
      (req.session as any).lastActivity = Date.now();
    }
    next();
  });

  // Set trust proxy for cross-domain cookies
  if (app.get("env") === "production") {
    app.set("trust proxy", 1);
  }

  passport.use(
    new LocalStrategy({ usernameField: 'userId' }, async (userId, password, done) => {
      try {
        // Try alphanumeric client reference first, then fall back to numeric id
        let user = await storage.getUserByClientRef(userId.trim());
        if (!user) {
          const id = parseInt(userId, 10);
          if (!isNaN(id)) user = await storage.getUser(id);
        }
        if (!user || !(await comparePasswords(password, user.password))) {
          return done(null, false, { message: "Invalid credentials" });
        }
        if (user.loginRestricted) {
          const msg = user.loginRestrictionMessage?.trim() ||
            "Your account access has been restricted. Please contact support for assistance.";
          return done(null, false, { message: msg });
        }
        return done(null, user);
      } catch (err) {
        return done(err);
      }
    }),
  );

  passport.serializeUser((user, done) => done(null, (user as User).id));
  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (err) {
      done(err);
    }
  });

  return { hashPassword };
}
