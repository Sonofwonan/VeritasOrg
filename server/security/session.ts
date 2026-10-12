import type { Request } from "express";
import type { User } from "@shared/schema";

declare module "express-session" {
  interface SessionData {
    authVersion?: number;
    mfaVerified?: boolean;
    pendingMfa?: { userId: number; version: number; passwordStamp: string; expiresAt: number; attempts: number };
    lastActivity?: number;
  }
}

export function saveSession(req: Request) {
  return new Promise<void>((resolve, reject) => req.session.save(error => error ? reject(error) : resolve()));
}
export function destroySession(req: Request) {
  return new Promise<void>((resolve, reject) => req.session.destroy(error => error ? reject(error) : resolve()));
}
export function regenerateSession(req: Request) {
  return new Promise<void>((resolve, reject) => req.session.regenerate(error => error ? reject(error) : resolve()));
}
export async function finishLogin(req: Request, user: User, version: number, mfaVerified: boolean) {
  await regenerateSession(req);
  await new Promise<void>((resolve, reject) => req.logIn(user, { session: true, keepSessionInfo: true }, error => error ? reject(error) : resolve()));
  delete req.session.pendingMfa;
  req.session.authVersion = version;
  req.session.mfaVerified = mfaVerified;
  req.session.lastActivity = Date.now();
  await saveSession(req);
}
