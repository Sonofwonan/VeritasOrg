import { Express, Request, Response, NextFunction } from "express";
import session from "express-session";
import connectPg from "connect-pg-simple";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { randomBytes } from "crypto";
import { pool } from "./db";
import { storage } from "./storage";
import { User } from "@shared/schema";
import { comparePasswords, hashPassword } from "./security/crypto";
import { getSecurity } from "./security/store";
import { destroySession } from "./security/session";

const PgSession = connectPg(session);
const dummyPasswordHash = hashPassword(randomBytes(32).toString("hex"));

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
  if (!process.env.SESSION_SECRET) throw new Error("SESSION_SECRET is required.");
  const sessionSettings: session.SessionOptions = {
    store: new PgSession({ 
      pool, 
      createTableIfMissing: true, 
      tableName: 'session'
    }),
    secret: process.env.SESSION_SECRET,
    resave: false,
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

  // Every client route, including independently registered fee/funds routes,
  // must reject revoked sessions and sessions missing a verified second factor.
  app.use(async (req: Request, res: Response, next: NextFunction) => {
    if (!req.path.startsWith("/api/") || !req.isAuthenticated() ||
        ["/api/login", "/api/logout"].includes(req.path) || req.path.startsWith("/api/admin/")) return next();
    try {
      const user = req.user as User;
      const security = await getSecurity(user.id);
      const expired = req.session.lastActivity && Date.now() - req.session.lastActivity > INACTIVITY_LIMIT_MS;
      if ((req.session.authVersion ?? 0) !== security.version ||
          (security.mfa_enabled && req.session.mfaVerified !== true) || expired) {
        await destroySession(req);
        return void res.status(401).json({ message: "Please sign in again." });
      }
      // Existing route-specific freeze/funds guards retain their semantics.
      // In particular, the profile and access-status endpoints must still let
      // an already signed-in client see the normal account-on-hold screen.
      // Check expiry before updating activity, never after a background poll.
      if (!isPollingRequest(req)) req.session.lastActivity = Date.now();
      next();
    } catch {
      res.status(503).json({ message: "We couldn’t verify your session. Please try again." });
    }
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
          const id = /^\d+$/.test(userId) ? Number(userId) : NaN;
          if (Number.isSafeInteger(id)) user = await storage.getUser(id);
        }
        const valid = await comparePasswords(password, user?.password || await dummyPasswordHash);
        if (!user || !valid) {
          return done(null, false, { message: "Invalid credentials" });
        }
        if ((user as any).accountFrozen) {
          return done(null, false, { message: "ACCOUNT_FROZEN" });
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
