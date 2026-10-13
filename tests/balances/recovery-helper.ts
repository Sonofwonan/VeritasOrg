import type { APIRequestContext } from "@playwright/test";
import { expect } from "@playwright/test";
import { recoveryRequestPath, adminRecoveryRequestPath } from "../../shared/client-settings";

// Normal authenticated client request and admin approval; only isolated runner
// credentials are accepted. Do not use this helper against a shared server.
export async function issueRequestedCodes(request: APIRequestContext, identity: { password: string; ref: string }) {
  const pending = await request.post(recoveryRequestPath, { data: { currentPassword: identity.password } });
  expect(pending.status()).toBe(202);
  const { id } = await pending.json();
  const issued = await request.post(`${adminRecoveryRequestPath}/${id}/issue`, {
    headers: { "x-admin-key": process.env.BALANCE_E2E_ADMIN! }, data: { identityVerified: true },
  });
  expect(issued.status()).toBe(200);
  const codes: string[] = (await issued.json()).recoveryCodes;
  expect(codes).toHaveLength(10);
  expect((await request.get("/api/user")).status()).toBe(401);
  expect((await request.post("/api/login", { data: { userId: identity.ref, password: identity.password } })).status()).toBe(202);
  expect((await request.post("/api/security/two-factor/challenge", { data: { code: codes[9] } })).status()).toBe(200);
  return codes;
}
