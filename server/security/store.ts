import type { PoolClient } from "pg";
import { pool } from "../db";
import type { User } from "@shared/schema";
import { decryptSecret, digest, recoveryDigest, SecurityError, verifyTotp } from "./crypto";

export type SecurityState = {
  user_id: number; version: number; mfa_enabled: boolean; secret: string | null;
  last_totp_step: string; pending_secret: string | null; pending_expires: Date | null;
  pending_session: string | null;
};

export async function initializeSecurity() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS client_security (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      version INTEGER NOT NULL DEFAULT 0,
      mfa_enabled BOOLEAN NOT NULL DEFAULT FALSE,
      secret TEXT,
      last_totp_step BIGINT NOT NULL DEFAULT -1,
      pending_secret TEXT,
      pending_expires TIMESTAMPTZ,
      pending_session TEXT,
      CHECK (NOT mfa_enabled OR secret IS NOT NULL)
    );
    CREATE TABLE IF NOT EXISTS client_security_recovery (
      id BIGSERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      digest TEXT NOT NULL UNIQUE,
      consumed_at TIMESTAMPTZ
    );
    CREATE TABLE IF NOT EXISTS client_security_events (
      id BIGSERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      event TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS client_auth_limits (
      bucket TEXT PRIMARY KEY,
      attempts INTEGER NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL
    );
    CREATE TABLE IF NOT EXISTS session (
      sid VARCHAR PRIMARY KEY, sess JSON NOT NULL, expire TIMESTAMP NOT NULL
    );
    CREATE INDEX IF NOT EXISTS client_session_expire ON session(expire);
  `);
}

export async function getSecurity(userId: number): Promise<SecurityState> {
  const result = await pool.query("SELECT * FROM client_security WHERE user_id=$1", [userId]);
  return result.rows[0] || {
    user_id: userId, version: 0, mfa_enabled: false, secret: null,
    last_totp_step: "-1", pending_secret: null, pending_expires: null, pending_session: null,
  };
}

export async function safeUser(user: User) {
  const { password: _password, ...publicUser } = user;
  const state = await getSecurity(user.id);
  return { ...publicUser, twoFactorEnabled: state.mfa_enabled };
}

export async function withSecurity<T>(userId: number, action: (db: PoolClient, state: SecurityState, user: User) => Promise<T>) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("INSERT INTO client_security(user_id) VALUES($1) ON CONFLICT DO NOTHING", [userId]);
    const { rows: [state] } = await client.query("SELECT * FROM client_security WHERE user_id=$1 FOR UPDATE", [userId]);
    // Consistent lock order protects credential changes and one-time code consumption.
    const { rows: [raw] } = await client.query("SELECT password, account_frozen, login_restricted FROM users WHERE id=$1 FOR UPDATE", [userId]);
    if (!raw || raw.account_frozen || raw.login_restricted) throw new SecurityError(403, "Account access is restricted. Please contact your advisor.");
    const user = { id: userId, password: raw.password } as User;
    const result = await action(client, state, user);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}

// Persistent, atomic limits also apply across workers and server restarts.
export async function rateLimit(bucket: string, max = 12) {
  const { rows: [row] } = await pool.query(`
    INSERT INTO client_auth_limits(bucket,attempts,expires_at) VALUES($1,1,NOW()+INTERVAL '15 minutes')
    ON CONFLICT(bucket) DO UPDATE SET
      attempts=CASE WHEN client_auth_limits.expires_at<=NOW() THEN 1 ELSE client_auth_limits.attempts+1 END,
      expires_at=CASE WHEN client_auth_limits.expires_at<=NOW() THEN NOW()+INTERVAL '15 minutes' ELSE client_auth_limits.expires_at END
    RETURNING attempts`, [digest(bucket)]);
  if (row.attempts > max) throw new SecurityError(429, "Too many attempts. Please try again in 15 minutes.");
  // Expired buckets contain no identity data and need not accumulate indefinitely.
  await pool.query("DELETE FROM client_auth_limits WHERE expires_at < NOW()-INTERVAL '1 day'");
}

export async function consumeFactor(db: PoolClient, state: SecurityState, code: string) {
  if (!state.mfa_enabled || !state.secret) throw new SecurityError(409, "Two-factor authentication is not set up.");
  if (/^\d{6}$/.test(code)) {
    const step = await verifyTotp(decryptSecret(state.secret, state.user_id), code, Number(state.last_totp_step));
    if (step === null) throw new SecurityError(400, "Enter a new code from your authenticator app.");
    await db.query("UPDATE client_security SET last_totp_step=$2 WHERE user_id=$1", [state.user_id, step]);
  } else {
    if (!/^[a-f0-9]{20}$/i.test(code.replace(/-/g, ""))) throw new SecurityError(400, "Enter a valid security or recovery code.");
    const result = await db.query(
      "UPDATE client_security_recovery SET consumed_at=NOW() WHERE user_id=$1 AND digest=$2 AND consumed_at IS NULL RETURNING id",
      [state.user_id, recoveryDigest(state.user_id, code)],
    );
    if (result.rowCount !== 1) throw new SecurityError(400, "This recovery code is invalid or has already been used.");
  }
}

export async function revokeSessions(db: PoolClient, userId: number, keepSid?: string) {
  await db.query(`DELETE FROM session WHERE
    (sess::jsonb->'passport'->>'user'=$1 OR sess::jsonb->'pendingMfa'->>'userId'=$1)
    AND ($2::TEXT IS NULL OR sid<>$2)`, [String(userId), keepSid || null]);
}

export const audit = (db: PoolClient, userId: number, event: string) =>
  db.query("INSERT INTO client_security_events(user_id,event) VALUES($1,$2)", [userId, event]);
