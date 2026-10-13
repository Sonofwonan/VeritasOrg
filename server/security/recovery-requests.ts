import type { Express, RequestHandler } from "express";
import { z } from "zod";
import type { User } from "@shared/schema";
import { recoveryRequestPath, adminRecoveryRequestPath } from "@shared/client-settings";
import { pool } from "../db";
import { audit, rateLimit, revokeSessions, withSecurity } from "./store";
import { comparePasswords, newRecoveryCodes, SecurityError } from "./crypto";
import { replaceRecoveryCodes, securityHandler, securityOrigin } from "./routes";

export async function registerRecoveryRequests(app: Express, authenticated: RequestHandler, requireAdmin: RequestHandler) {
  await pool.query(`CREATE TABLE IF NOT EXISTS client_recovery_requests (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','issued','rejected')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ
  );
  CREATE UNIQUE INDEX IF NOT EXISTS client_recovery_one_pending
    ON client_recovery_requests(user_id) WHERE status='pending'`);

  app.get(recoveryRequestPath, authenticated, securityHandler(async (req, res) => {
    const { rows } = await pool.query(`SELECT id,status,created_at AS "createdAt",reviewed_at AS "reviewedAt"
      FROM client_recovery_requests WHERE user_id=$1 ORDER BY id DESC LIMIT 1`, [(req.user as User).id]);
    res.json(rows[0] || null);
  }));
  app.post(recoveryRequestPath, authenticated, securityOrigin, securityHandler(async (req, res) => {
    const { currentPassword } = z.object({ currentPassword: z.string().min(1).max(128) }).strict().parse(req.body);
    const userId = (req.user as User).id;
    await rateLimit(`recovery-request:${userId}`);
    const request = await withSecurity(userId, async (db, state, user) => {
      if (!await comparePasswords(currentPassword, user.password)) throw new SecurityError(400, "Your current password is incorrect.");
      if (!state.mfa_enabled) throw new SecurityError(409, "Set up two-factor authentication before requesting recovery codes.");
      const { rows: [row] } = await db.query(`INSERT INTO client_recovery_requests(user_id) VALUES($1)
        ON CONFLICT(user_id) WHERE status='pending' DO UPDATE SET user_id=EXCLUDED.user_id
        RETURNING id,status,created_at AS "createdAt",reviewed_at AS "reviewedAt"`, [userId]);
      await audit(db, userId, "recovery_codes_requested");
      return row;
    });
    res.status(202).json(request);
  }));

  const adminConfigured: RequestHandler = (_req, res, next) => {
    if (!process.env.ADMIN_PASSWORD) return void res.status(503).json({message: "Administrator access is not configured."});
    next();
  };
  app.get(adminRecoveryRequestPath, adminConfigured, requireAdmin, securityHandler(async (_req, res) => {
    const { rows } = await pool.query(`SELECT r.id,r.status,r.created_at AS "createdAt",r.reviewed_at AS "reviewedAt",
      u.name,u.client_ref AS "clientRef" FROM client_recovery_requests r JOIN users u ON u.id=r.user_id ORDER BY r.id DESC LIMIT 200`);
    res.json(rows);
  }));
  app.post(`${adminRecoveryRequestPath}/:id/:action`, adminConfigured, requireAdmin, securityOrigin, securityHandler(async (req, res) => {
    const id = z.coerce.number().int().positive().parse(req.params.id);
    const action = z.enum(["issue", "reject"]).parse(req.params.action);
    const input = z.object({ identityVerified: z.boolean() }).strict().parse(req.body);
    if (action === "issue" && !input.identityVerified) throw new SecurityError(400, "Verify the client's identity before issuing recovery codes.");
    const { rows: [request] } = await pool.query("SELECT user_id FROM client_recovery_requests WHERE id=$1", [id]);
    if (!request) throw new SecurityError(404, "Request not found.");
    await rateLimit(`admin-recovery:${request.user_id}`);
    const codes = action === "issue" ? newRecoveryCodes() : [];
    await withSecurity(request.user_id, async (db, state) => {
      const { rows: [locked] } = await db.query("SELECT status FROM client_recovery_requests WHERE id=$1 FOR UPDATE", [id]);
      if (locked?.status !== "pending") throw new SecurityError(409, "This request has already been reviewed.");
      if (action === "issue") {
        if (!state.mfa_enabled) throw new SecurityError(409, "The client no longer has two-factor authentication enabled.");
        await replaceRecoveryCodes(db, request.user_id, codes);
        await db.query("UPDATE client_security SET version=version+1 WHERE user_id=$1", [request.user_id]);
        await revokeSessions(db, request.user_id);
      }
      await db.query("UPDATE client_recovery_requests SET status=$2,reviewed_at=NOW() WHERE id=$1", [id, action === "issue" ? "issued" : "rejected"]);
      await audit(db, request.user_id, action === "issue" ? "admin_recovery_codes_issued_identity_verified" : "admin_recovery_request_rejected");
    });
    res.json(action === "issue" ? { recoveryCodes: codes } : { ok: true });
  }));
}
