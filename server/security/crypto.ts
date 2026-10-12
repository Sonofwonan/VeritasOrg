import { createCipheriv, createDecipheriv, createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { generateSecret, verify } from "otplib";

const derive = promisify(scrypt);

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = await derive(password, salt, 64) as Buffer;
  return `${hash.toString("hex")}.${salt}`;
}

export async function comparePasswords(password: string, stored: string) {
  if (!/^[a-f0-9]{128}\.[a-f0-9]{32}$/i.test(stored || "")) return false;
  const [hash, salt] = stored.split(".");
  const supplied = await derive(password, salt, 64) as Buffer;
  return timingSafeEqual(Buffer.from(hash, "hex"), supplied);
}

function encryptionKey() {
  const value = process.env.MFA_ENCRYPTION_KEY || "";
  const key = /^[a-f0-9]{64}$/i.test(value) ? Buffer.from(value, "hex") :
    /^[A-Za-z0-9+/]{43}=?$/.test(value) ? Buffer.from(value, "base64") : Buffer.alloc(0);
  if (key.length !== 32) throw new SecurityError(503, "Two-factor setup needs a security update. Please contact support.");
  return key;
}

export function encryptionConfigured() {
  try { encryptionKey(); return true; } catch { return false; }
}

export function encryptSecret(secret: string, userId: number) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  cipher.setAAD(Buffer.from(`veritas:mfa:v1:${userId}`));
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), encrypted.toString("base64")].join(".");
}

export function decryptSecret(value: string, userId: number) {
  const key = encryptionKey();
  try {
    const [version, iv, tag, data] = value.split(".");
    if (version !== "v1" || !iv || !tag || !data) throw new Error();
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64"));
    decipher.setAAD(Buffer.from(`veritas:mfa:v1:${userId}`));
    decipher.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8");
  } catch {
    throw new SecurityError(503, "We couldn’t verify your security code. Please contact support.");
  }
}

export { generateSecret };
export const digest = (value: string) => createHash("sha256").update(value).digest("hex");
export const recoveryDigest = (userId: number, code: string) => digest(`${userId}:${code.replace(/-/g, "").toLowerCase()}`);
export const newRecoveryCodes = () => Array.from({ length: 10 }, () => randomBytes(10).toString("hex").toUpperCase().match(/.{4}/g)!.join("-"));

export async function verifyTotp(secret: string, code: string, afterTimeStep = -1, epoch = Math.floor(Date.now() / 1000)) {
  if (!/^\d{6}$/.test(code)) return null;
  if (afterTimeStep > Math.floor(epoch / 30) + 1) return null;
  const result = await verify({ strategy: "totp", secret, token: code, epoch, epochTolerance: 30,
    ...(afterTimeStep >= 0 ? { afterTimeStep } : {}),
  });
  return result.valid && "timeStep" in result ? result.timeStep : null;
}

export class SecurityError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
