import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { generate } from "otplib";
import { comparePasswords, decryptSecret, encryptSecret, generateSecret, hashPassword, verifyTotp } from "../server/security/crypto";
import { isTrustedOrigin } from "../server/security/origins";

const requestHost = { get: (_name: string) => "api.example" } as Parameters<typeof isTrustedOrigin>[1];
for (const NODE_ENV of ["production", "development"]) {
  const env = { NODE_ENV, CLIENT_URL: " https://configured.example/ ", REPLIT_DOMAINS: "owned.replit.dev" };
  for (const origin of [undefined, "https://api.example", "https://configured.example",
    "https://veritaswealth.vercel.app", "https://veritas-wealth.vercel.app", "https://owned.replit.dev"]) {
    assert.ok(isTrustedOrigin(origin, requestHost, env), `Trusted origin rejected: ${origin}`);
  }
  for (const origin of ["null", "", "https://attacker.invalid", "https://attacker.replit.dev",
    "https://attacker.vercel.app", "https://api.example.attacker.invalid", "https://api.example/path",
    "https://user@api.example", "https://api.example:8443"]) {
    assert.ok(!isTrustedOrigin(origin, requestHost, env), `Untrusted origin accepted: ${origin}`);
  }
  assert.equal(isTrustedOrigin("http://api.example", requestHost, env), NODE_ENV !== "production");
}

// Pure cryptographic checks: no database access and only generated test material.
process.env.MFA_ENCRYPTION_KEY = randomBytes(32).toString("base64");
const password = randomBytes(24).toString("hex");
const hash = await hashPassword(password);
assert.ok(await comparePasswords(password, hash), "Correct password must verify");
assert.ok(!await comparePasswords(`${password}x`, hash), "Wrong password must fail");
for (const malformed of ["", "plain", "ff.x", "x".repeat(128) + "." + "a".repeat(32)]) {
  assert.ok(!await comparePasswords(password, malformed), "Malformed hash must fail safely");
}
const secret = generateSecret();
const encrypted = encryptSecret(secret, 42);
assert.ok(!encrypted.includes(secret), "Encrypted data must not contain plaintext");
assert.ok(decryptSecret(encrypted, 42) === secret, "Encrypted secret must round trip");
assert.throws(() => decryptSecret(encrypted, 43), /verify your security code/, "Ciphertext must be account-bound");
assert.throws(() => decryptSecret(encrypted.replace(/^v1/, "v2"), 42), /verify your security code/);
// RFC 6238 SHA-1 vector, truncated to the standard six-digit authenticator code.
const vector = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
assert.equal(await verifyTotp(vector, "287082", -1, 59), 1);
assert.equal(await verifyTotp(vector, "287082", 1, 59), null, "Replayed code must fail");
assert.equal(await verifyTotp(vector, "287082", -1, 159), null, "Expired code must fail");
assert.equal(await verifyTotp(vector, "not-a-code", -1, 59), null);
// The seconds-based ±60 window includes two past/future 30-second steps.
// Test both sides of boundaries independently of verifier implementation constants.
for (const epoch of [599, 600, 601, 629, 630, 631]) {
  const currentStep = Math.floor(epoch / 30);
  for (let offset = -3; offset <= 3; offset++) {
    const step = currentStep + offset;
    const token = await generate({ secret: vector, epoch: step * 30 });
    const expected = Math.abs(offset) <= 2 ? step : null;
    assert.equal(await verifyTotp(vector, token, -1, epoch), expected,
      `Unexpected tolerance at epoch ${epoch}, step offset ${offset}`);
    if (expected !== null) {
      assert.equal(await verifyTotp(vector, token, step - 1, epoch), step, "Unused skewed step must verify");
      assert.equal(await verifyTotp(vector, token, step, epoch), null, "Used skewed step must fail");
      assert.equal(await verifyTotp(vector, token, step + 1, epoch), null, "Earlier steps must remain consumed");
    }
  }
}
const boundaryToken = await generate({ secret: vector, epoch: 600 });
assert.equal(await verifyTotp(vector, boundaryToken, -1, 539), null, "Beyond future tolerance must fail");
assert.equal(await verifyTotp(vector, boundaryToken, -1, 540), 20, "Future boundary is inclusive");
assert.equal(await verifyTotp(vector, boundaryToken, -1, 689), 20, "Final past-window second must verify");
assert.equal(await verifyTotp(vector, boundaryToken, -1, 690), null, "First expired second must fail");
for (const invalid of ["", "12345", "1234567", "abcdef", "１２３４５６", " 287082 "]) {
  assert.equal(await verifyTotp(vector, invalid, -1, 59), null, "Malformed codes must fail");
}
delete process.env.MFA_ENCRYPTION_KEY;
assert.throws(() => encryptSecret(secret, 42), /security update/, "Missing key must not silently use a fallback");
console.log("Security cryptography checks passed (generated test material only).");
