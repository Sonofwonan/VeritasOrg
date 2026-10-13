import type { Express, Request, Response, NextFunction } from "express";
import { z } from "zod";
import QRCode from "qrcode";
import { generateURI } from "otplib";
import { pool } from "../db";
import { storage } from "../storage";
import type { User } from "@shared/schema";
import { securityPaths } from "@shared/security";
import { comparePasswords, decryptSecret, digest, encryptSecret, generateSecret, hashPassword, recoveryDigest, SecurityError, verifyTotp } from "./crypto";
import { audit, consumeFactor, getSecurity, rateLimit, revokeSessions, safeUser, withSecurity } from "./store";
import { destroySession, finishLogin } from "./session";
import { isTrustedOrigin } from "./origins";

const reauthentication = z.object({
  currentPassword: z.string().min(1, "Enter your current password.").max(128, "Use no more than 128 characters."),
  code: z.string().trim().max(128).optional(),
}).strict();

// Browsers must make sensitive writes from an explicitly trusted origin using JSON.
export function securityOrigin(req: Request, res: Response, next: NextFunction) {
  const origin = req.get("origin");
  if (!isTrustedOrigin(origin, req) || !req.is("application/json")) {
    return void res.status(403).json({ message: "This security request could not be verified." });
  }
  next();
}

export function securityHandler(handler: (req: Request, res: Response) => Promise<unknown>) {
  return async (req: Request, res: Response) => {
    res.setHeader("Cache-Control", "no-store");
    try { await handler(req, res); }
    catch (error) {
      if (error instanceof z.ZodError) return void res.status(400).json({ message: error.errors[0]?.message || "Check your security details." });
      if (error instanceof SecurityError) return void res.status(error.status).json({ message: error.message });
      // No SQL parameters, credentials, authenticator secrets, or recovery codes in logs.
      console.error("Security request failed.");
      res.status(500).json({ message: "We couldn’t update your security settings. Please try again." });
    }
  };
}

export function registerSecurityRoutes(app: Express) {
  const authenticated = (req: Request, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated()) return void res.status(401).json({ message: "Please sign in again." });
    next();
  };
  app.get(securityPaths.status, authenticated, securityHandler(async (req, res) => {
    const user = req.user as User;
    const state = await getSecurity(user.id);
    const { rows: [codes] } = await pool.query("SELECT COUNT(*)::INTEGER AS count FROM client_security_recovery WHERE user_id=$1 AND consumed_at IS NULL", [user.id]);
    res.json({ twoFactorEnabled: state.mfa_enabled, setupRequired: user.twoFactorEnabled && !state.mfa_enabled, recoveryCodesRemaining: codes.count });
  }));

  const sensitive = [authenticated, securityOrigin];
  app.post(securityPaths.password, ...sensitive, securityHandler(async (req, res) => {
    const input = reauthentication.extend({
      newPassword: z.string().min(12, "Use at least 12 characters.").max(128),
      confirmPassword: z.string().max(128),
    }).refine(value => value.newPassword === value.confirmPassword, "The new passwords don’t match.").parse(req.body);
    const userId = (req.user as User).id;
    await rateLimit(`security:${userId}`);
    if (input.currentPassword === input.newPassword) throw new SecurityError(400, "Choose a different password.");
    const hash = await hashPassword(input.newPassword);
    await withSecurity(userId, async (db, state, user) => {
      if (!await comparePasswords(input.currentPassword, user.password)) throw new SecurityError(400, "Your current password is incorrect.");
      if (state.mfa_enabled) await consumeFactor(db, state, input.code || "");
      await db.query("UPDATE users SET password=$2 WHERE id=$1", [userId, hash]);
      await db.query("UPDATE client_security SET version=version+1,pending_secret=NULL,pending_expires=NULL,pending_session=NULL WHERE user_id=$1", [userId]);
      await revokeSessions(db, userId);
      await audit(db, userId, "password_changed");
    });
    await destroySession(req);
    res.clearCookie("connect.sid", { path: "/" });
    res.json({ ok: true });
  }));

  app.post(securityPaths.setup, ...sensitive, securityHandler(async (req, res) => {
    const { currentPassword } = reauthentication.parse(req.body);
    const user = req.user as User;
    await rateLimit(`security:${user.id}`);
    const secret = generateSecret();
    const encrypted = encryptSecret(secret, user.id);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    const uri = generateURI({ secret, issuer: "Veritas Wealth", label: user.clientRef || String(user.id) });
    const qrCodeDataUrl = await QRCode.toDataURL(uri);
    await withSecurity(user.id, async (db, state, current) => {
      if (!await comparePasswords(currentPassword, current.password)) throw new SecurityError(400, "Your current password is incorrect.");
      if (state.mfa_enabled) throw new SecurityError(409, "Two-factor authentication is already enabled.");
      await db.query("UPDATE client_security SET pending_secret=$2,pending_expires=$3,pending_session=$4 WHERE user_id=$1", [user.id, encrypted, expiresAt, digest(req.sessionID)]);
      await audit(db, user.id, "mfa_setup_started");
    });
    res.json({ secret, qrCodeDataUrl, expiresAt: expiresAt.toISOString() });
  }));

  app.post(securityPaths.confirm, ...sensitive, securityHandler(async (req, res) => {
    const { code } = z.object({ code: z.string().trim().regex(/^\d{6}$/, "Enter the six-digit code from your app.") }).strict().parse(req.body);
    const user = req.user as User;
    await rateLimit(`security:${user.id}`);
    // Recovery sets are issued only by an administrator after a client request.
    const codes: string[] = [];
    const version = await withSecurity(user.id, async (db, state) => {
      if (state.mfa_enabled || !state.pending_secret || !state.pending_expires ||
          state.pending_expires.getTime() <= Date.now() || state.pending_session !== digest(req.sessionID)) {
        throw new SecurityError(400, "Setup has expired. Please start again.");
      }
      const step = await verifyTotp(decryptSecret(state.pending_secret, user.id), code);
      if (step === null) throw new SecurityError(400, "Enter a valid code from your authenticator app.");
      await db.query("UPDATE client_security SET mfa_enabled=TRUE,secret=pending_secret,last_totp_step=$2,version=version+1,pending_secret=NULL,pending_expires=NULL,pending_session=NULL WHERE user_id=$1", [user.id, step]);
      await db.query("UPDATE users SET two_factor_enabled=TRUE WHERE id=$1", [user.id]);
      await replaceRecoveryCodes(db, user.id, codes);
      await revokeSessions(db, user.id, req.sessionID);
      await audit(db, user.id, "mfa_enabled");
      return state.version + 1;
    });
    await finishLogin(req, user, version, true);
    res.json({ recoveryCodes: codes });
  }));

  app.post(securityPaths.recovery, ...sensitive, securityHandler(async (_req, res) => {
    res.status(403).json({ message: "Only an administrator can issue recovery codes. Submit a request in Security settings." });
  }));

  for (const operation of ["disable"] as const) {
    app.post(securityPaths[operation], ...sensitive, securityHandler(async (req, res) => {
      const input = reauthentication.parse(req.body);
      const user = req.user as User;
      await rateLimit(`security:${user.id}`);
      const codes: string[] = [];
      const version = await withSecurity(user.id, async (db, state, current) => {
        if (!await comparePasswords(input.currentPassword, current.password)) throw new SecurityError(400, "Your current password is incorrect.");
        await consumeFactor(db, state, input.code || "");
        if (operation === "disable") {
          await db.query("UPDATE client_security SET mfa_enabled=FALSE,secret=NULL,last_totp_step=-1,version=version+1,pending_secret=NULL,pending_expires=NULL,pending_session=NULL WHERE user_id=$1", [user.id]);
          await db.query("UPDATE users SET two_factor_enabled=FALSE WHERE id=$1", [user.id]);
        } else {
          await db.query("UPDATE client_security SET version=version+1 WHERE user_id=$1", [user.id]);
        }
        await replaceRecoveryCodes(db, user.id, codes);
        await revokeSessions(db, user.id, req.sessionID);
        await audit(db, user.id, operation === "disable" ? "mfa_disabled" : "recovery_codes_replaced");
        return state.version + 1;
      });
      await finishLogin(req, user, version, operation !== "disable");
      res.json(operation === "disable" ? { ok: true } : { recoveryCodes: codes });
    }));
  }

  // A pending password-only session has no Passport identity and cannot access any client API.
  app.post(securityPaths.challenge, securityOrigin, securityHandler(async (req, res) => {
    const { code } = z.object({ code: z.string().trim().min(1).max(128) }).strict().parse(req.body);
    const pending = req.session.pendingMfa;
    if (!pending || pending.expiresAt <= Date.now() || pending.attempts >= 5) {
      await destroySession(req);
      throw new SecurityError(401, "Please sign in again to get a new security check.");
    }
    pending.attempts += 1;
    await rateLimit(`mfa-login:${pending.userId}`, 10);
    const version = await withSecurity(pending.userId, async (db, state, user) => {
      if (!state.mfa_enabled || state.version !== pending.version || digest(user.password) !== pending.passwordStamp) {
        throw new SecurityError(401, "Please sign in again.");
      }
      await consumeFactor(db, state, code);
      await audit(db, pending.userId, "mfa_sign_in");
      return state.version;
    });
    const user = await storage.getUser(pending.userId);
    if (!user) throw new SecurityError(401, "Please sign in again.");
    await finishLogin(req, user, version, true);
    res.json(await safeUser(user));
  }));
}

export async function replaceRecoveryCodes(db: import("pg").PoolClient, userId: number, codes: string[]) {
  await db.query("DELETE FROM client_security_recovery WHERE user_id=$1", [userId]);
  for (const code of codes) await db.query("INSERT INTO client_security_recovery(user_id,digest) VALUES($1,$2)", [userId, recoveryDigest(userId, code)]);
}
