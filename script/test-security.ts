import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { comparePasswords, decryptSecret, encryptSecret, generateSecret, hashPassword, verifyTotp } from "../server/security/crypto";

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
delete process.env.MFA_ENCRYPTION_KEY;
assert.throws(() => encryptSecret(secret, 42), /security update/, "Missing key must not silently use a fallback");
console.log("Security cryptography checks passed (generated test material only).");
