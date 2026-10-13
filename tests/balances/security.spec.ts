import { test, expect, login } from "./fixtures";
import { generate } from "otplib";
import { randomBytes } from "node:crypto";
import type { APIRequestContext } from "@playwright/test";

// Never retain traces/screenshots containing even disposable enrollment secrets.
test.use({ trace: "off", screenshot: "off", video: "off" });

async function financialSnapshot(db: import("pg").Pool, userId: number) {
  return Promise.all([
    "SELECT * FROM accounts WHERE user_id=$1 ORDER BY id",
    "SELECT * FROM transactions WHERE from_account_id IN (SELECT id FROM accounts WHERE user_id=$1) OR to_account_id IN (SELECT id FROM accounts WHERE user_id=$1) ORDER BY id",
    "SELECT * FROM investments WHERE account_id IN (SELECT id FROM accounts WHERE user_id=$1) ORDER BY id",
    "SELECT * FROM fee_enrollments WHERE user_id=$1 ORDER BY id",
    "SELECT * FROM fee_assessments WHERE account_id IN (SELECT id FROM accounts WHERE user_id=$1) ORDER BY id",
    "SELECT * FROM management_contracts WHERE user_id=$1 ORDER BY id",
    "SELECT account_frozen,login_restricted,display_currency,debt_clearance_required,debt_payment_account_id,debt_payment_confirmed_at FROM users WHERE id=$1",
  ].map(async sql => (await db.query(sql, [userId])).rows));
}

test("security past-code grace permits two-step-old enrollment and normal password login without reenrollment", async ({page,identity,db,playwright}) => {
  await login(page, identity);
  await page.close();
  const before = await financialSnapshot(db,identity.userId);
  const setup = await page.request.post("/api/security/two-factor/setup", {data:{currentPassword:identity.password}});
  expect(setup.status()).toBe(200);
  const {secret} = await setup.json();
  // Use real server time, not an authentication/clock bypass. Leave enough time
  // to enroll with the oldest accepted step before its real boundary expires.
  if (Date.now()%30000 > 25000) {
    await new Promise(resolve => setTimeout(resolve,30000-Date.now()%30000+100));
  }
  const step = Math.floor(Date.now()/30000);
  const enrollment = await page.request.post("/api/security/two-factor/confirm", {
    data:{code:await generate({secret,epoch:(step-2)*30})},
  });
  expect(enrollment.status()).toBe(200);
  const encrypted = (await db.query("SELECT secret FROM client_security WHERE user_id=$1", [identity.userId])).rows[0].secret;
  const other = await playwright.request.newContext({baseURL:process.env.BALANCE_E2E_URL});
  try {
    expect((await other.post("/api/login", {data:{userId:identity.ref,password:identity.password}})).status()).toBe(202);
    const code = await generate({secret,epoch:(step-1)*30});
    // This newer, unused code becomes two steps old when the next period starts.
    await new Promise(resolve => setTimeout(resolve,Math.max(0,(step+1)*30000-Date.now()+100)));
    expect((await other.post("/api/security/two-factor/challenge", {data:{code}})).status()).toBe(200);
    expect((await other.get("/api/accounts")).status()).toBe(200);
    const state = (await db.query("SELECT secret,last_totp_step FROM client_security WHERE user_id=$1", [identity.userId])).rows[0];
    expect(state.secret === encrypted).toBe(true);
    expect(Number(state.last_totp_step)).toBe(step-1);
    expect((await other.post("/api/login", {data:{userId:identity.ref,password:identity.password}})).status()).toBe(202);
    expect((await other.post("/api/security/two-factor/challenge", {data:{code}})).status()).toBe(400);
    expect(await financialSnapshot(db,identity.userId)).toEqual(before);
  } finally { await other.dispose(); }
});

test("security 60-second skewed authenticator login is single-use across concurrent sessions and attempt limits remain", async ({page,identity,db,playwright}) => {
  await login(page, identity);
  await page.close();
  const before = await financialSnapshot(db, identity.userId);
  const setup = await page.request.post("/api/security/two-factor/setup", {data:{currentPassword:identity.password}});
  expect(setup.status()).toBe(200);
  const {secret} = await setup.json();
  expect((await page.request.post("/api/security/two-factor/confirm", {data:{code:await generate({secret})}})).status()).toBe(200);
  const contexts = await Promise.all([0,1].map(() => playwright.request.newContext({baseURL:process.env.BALANCE_E2E_URL})));
  try {
    for (const context of contexts) {
      expect((await context.post("/api/login", {data:{userId:identity.ref,password:identity.password}})).status()).toBe(202);
      expect((await context.get("/api/accounts")).status()).toBe(401);
    }
    const step = Math.floor(Date.now()/30000)+2;
    const code = await generate({secret,epoch:step*30});
    const results = await Promise.all(contexts.map(context => context.post("/api/security/two-factor/challenge", {data:{code}})));
    expect(results.map(result => result.status()).sort()).toEqual([200,400]);
    const winner = contexts[results.findIndex(result => result.status() === 200)];
    const loser = contexts[results.findIndex(result => result.status() === 400)];
    expect((await winner.get("/api/accounts")).status()).toBe(200);
    expect((await loser.get("/api/accounts")).status()).toBe(401);
    expect(Number((await db.query("SELECT last_totp_step FROM client_security WHERE user_id=$1", [identity.userId])).rows[0].last_totp_step)).toBe(step);
    expect((await winner.post("/api/security/two-factor/recovery", {data:{currentPassword:identity.password,code}})).status()).toBe(400);
    // The losing pending session has already spent one of its five attempts.
    for (let attempt=1; attempt<5; attempt++) {
      expect((await loser.post("/api/security/two-factor/challenge", {data:{code}})).status()).toBe(400);
    }
    expect((await loser.post("/api/security/two-factor/challenge", {data:{code}})).status()).toBe(401);
    expect((await loser.get("/api/accounts")).status()).toBe(401);
    expect(await financialSnapshot(db,identity.userId)).toEqual(before);
  } finally { await Promise.all(contexts.map(context => context.dispose())); }
});

for (const operation of ["password","recovery","disable"] as const) {
  test(`security 60-second skewed code supports protected ${operation} without changing financial records`, async ({page,identity,db}) => {
    await login(page, identity);
    await page.close();
    const before = await financialSnapshot(db,identity.userId);
    const setup = await page.request.post("/api/security/two-factor/setup", {data:{currentPassword:identity.password}});
    expect(setup.status()).toBe(200);
    const {secret} = await setup.json();
    expect((await page.request.post("/api/security/two-factor/confirm", {data:{code:await generate({secret})}})).status()).toBe(200);
    const epoch = (Math.floor(Date.now()/30000)+2)*30;
    const code = await generate({secret,epoch});
    const changed = randomBytes(24).toString("hex");
    const path = operation === "password" ? "/api/security/password" : `/api/security/two-factor/${operation}`;
    const data = operation === "password"
      ? {currentPassword:identity.password,newPassword:changed,confirmPassword:changed,code}
      : {currentPassword:identity.password,code};
    expect((await page.request.post(path, {data:{...data,currentPassword:"wrong"}})).status()).toBe(400);
    const result = await page.request.post(path, {data});
    expect(result.status()).toBe(200);
    if (operation === "password") {
      expect((await page.request.get("/api/user")).status()).toBe(401);
    } else if (operation === "recovery") {
      expect((await result.json()).recoveryCodes).toHaveLength(10);
      expect((await page.request.post(path,{data})).status()).toBe(400);
    } else {
      expect((await (await page.request.get("/api/security/status")).json()).twoFactorEnabled).toBe(false);
    }
    expect(await financialSnapshot(db,identity.userId)).toEqual(before);
  });
}

test("security password change verifies current password and revokes all sessions", async ({ page, identity, playwright }) => {
  await login(page, identity);
  // API-only checks keep the authenticated context, but stop dashboard polls
  // whose deliberately revoked cookies would otherwise create expected 401s.
  await page.close();
  const second = await playwright.request.newContext({ baseURL: process.env.BALANCE_E2E_URL });
  try {
    expect((await second.post("/api/login", { data: { userId: identity.ref, password: identity.password } })).status()).toBe(200);
    const changed = randomBytes(24).toString("hex");
    expect((await page.request.post("/api/security/password", { data: { currentPassword: "wrong", newPassword: changed, confirmPassword: changed } })).status()).toBe(400);
    expect((await page.request.post("/api/security/password", { data: { currentPassword: identity.password, newPassword: changed, confirmPassword: "mismatch" } })).status()).toBe(400);
    expect((await page.request.post("/api/security/password", { data: { currentPassword: identity.password, newPassword: changed, confirmPassword: changed } })).status()).toBe(200);
    expect((await page.request.get("/api/user")).status()).toBe(401);
    expect((await second.get("/api/accounts")).status()).toBe(401);
    expect((await second.post("/api/login", { data: { userId: identity.ref, password: identity.password } })).status()).toBe(401);
    const response = await second.post("/api/login", { data: { userId: identity.ref, password: changed } });
    expect(response.status()).toBe(200);
    expect(Object.keys(await response.json())).not.toContain("password");
  } finally { await second.dispose(); }
});

test("security authenticator login gates APIs and one-time codes cannot be replayed", async ({ page, identity, db, playwright }) => {
  await login(page, identity);
  await page.close();
  const before = await db.query("SELECT id,balance FROM accounts WHERE user_id=$1 ORDER BY id", [identity.userId]);
  const setup = await page.request.post("/api/security/two-factor/setup", { data: { currentPassword: identity.password } });
  expect(setup.status()).toBe(200);
  const enrollment = await setup.json();
  const code = await generate({ secret: enrollment.secret });
  const confirm = await page.request.post("/api/security/two-factor/confirm", { data: { code } });
  expect(confirm.status()).toBe(200);
  const codes: string[] = (await confirm.json()).recoveryCodes;
  expect(codes.length).toBe(10);
  const stored = (await db.query("SELECT secret FROM client_security WHERE user_id=$1", [identity.userId])).rows[0];
  expect(stored.secret === enrollment.secret).toBe(false);
  const digests = (await db.query("SELECT digest FROM client_security_recovery WHERE user_id=$1", [identity.userId])).rows;
  expect(digests.every(row => !codes.includes(row.digest))).toBe(true);
  const stranger = await playwright.request.newContext({ baseURL: process.env.BALANCE_E2E_URL });
  try {
    async function passwordOnly(context: APIRequestContext) {
      const result = await context.post("/api/login", { data: { userId: identity.ref, password: identity.password } });
      expect(result.status()).toBe(202);
      expect(await result.json()).toEqual({ mfaRequired: true });
    }
    await passwordOnly(stranger);
    for (const path of ["/api/user", "/api/accounts", "/api/transactions", "/api/security/status", `/api/accounts/${identity.debt}/fees`]) {
      expect((await stranger.get(path)).status(), path).toBe(401);
    }
    expect((await stranger.post("/api/transactions/transfer", { data: {} })).status()).toBe(401);
    expect((await stranger.post("/api/security/two-factor/challenge", { data: { code } })).status()).toBe(400);
    expect((await stranger.post("/api/security/two-factor/challenge", { data: { code: codes[0] } })).status()).toBe(200);
    expect((await stranger.get("/api/accounts")).status()).toBe(200);
    // A sensitive change needs fresh reauthentication even in an MFA-authenticated session.
    const changed = randomBytes(24).toString("hex");
    expect((await stranger.post("/api/security/password", { data: {
      currentPassword: identity.password, newPassword: changed, confirmPassword: changed,
    } })).status()).toBe(400);
    expect((await stranger.post("/api/security/two-factor/disable", { data: { currentPassword: identity.password } })).status()).toBe(400);
    await passwordOnly(stranger);
    expect((await stranger.post("/api/security/two-factor/challenge", { data: { code: codes[0] } })).status()).toBe(400);
    expect((await stranger.post("/api/security/two-factor/challenge", { data: { code: codes[1] } })).status()).toBe(200);
    const me = await stranger.get("/api/user");
    expect(Object.keys(await me.json())).not.toContain("password");
    expect((await stranger.post("/api/security/two-factor/disable", { data: { currentPassword: identity.password, code: codes[2] } })).status()).toBe(200);
    expect((await page.request.get("/api/user")).status()).toBe(401);
    expect((await stranger.get("/api/security/status")).status()).toBe(200);
    expect((await db.query("SELECT id,balance FROM accounts WHERE user_id=$1 ORDER BY id", [identity.userId])).rows).toEqual(before.rows);
  } finally { await stranger.dispose(); }
});

test("security rejects preference bypasses, cross-origin writes and legacy flags do not lock users out", async ({ page, identity, db }) => {
  await db.query("UPDATE users SET two_factor_enabled=TRUE WHERE id=$1", [identity.userId]);
  await login(page, identity);
  const status = await page.request.get("/api/security/status");
  expect(await status.json()).toEqual({ twoFactorEnabled: false, setupRequired: true, recoveryCodesRemaining: 0 });
  for (const data of [{ password: "bypass" }, { twoFactorEnabled: true }, { mfaSecret: "bypass" }, { authVersion: 0 }]) {
    expect((await page.request.patch("/api/user", { data })).status()).toBe(403);
  }
  expect((await page.request.post("/api/security/password", {
    headers: { origin: "https://attacker.invalid" },
    data: { currentPassword: identity.password, newPassword: "invalid", confirmPassword: "invalid" },
  })).status()).toBe(403);
  const payload = await (await page.request.get("/api/user")).json();
  expect(payload.twoFactorEnabled).toBe(false);
  expect(Object.keys(payload)).not.toContain("password");
  await page.goto("/settings");
  await page.getByRole("tab", { name: /security/i }).click();
  await expect(page.getByTestId("security-status")).toContainText(/not set up|complete|setup|not enabled|off/i);
  await expect(page.getByTestId("security-change-password")).toBeVisible();
  await expect(page.getByTestId("security-setup-two-factor")).toBeVisible();
});

for (const origin of ["https://veritaswealth.vercel.app", "https://veritas-wealth.vercel.app", "https://isolated-app.replit.dev"]) {
  test(`security trusted frontend ${origin} supports credentialed login and MFA`, async ({ page, identity, playwright }) => {
    await login(page, identity);
    await page.close(); // API checks must not race deliberately revoked dashboard sessions.
    const headers = { origin };
    const preflight = await page.request.fetch("/api/login", { method: "OPTIONS", headers: {
      origin, "access-control-request-method": "POST", "access-control-request-headers": "content-type",
    } });
    expect(preflight.status()).toBe(204);
    expect(preflight.headers()["access-control-allow-origin"]).toBe(origin);
    expect(preflight.headers()["access-control-allow-credentials"]).toBe("true");
    const setup = await page.request.post("/api/security/two-factor/setup", {
      headers, data: { currentPassword: identity.password },
    });
    expect(setup.status()).toBe(200);
    const enrollment = await page.request.post("/api/security/two-factor/confirm", {
      headers, data: { code: await generate({ secret: (await setup.json()).secret }) },
    });
    expect(enrollment.status()).toBe(200);
    const codes: string[] = (await enrollment.json()).recoveryCodes;
    const api = await playwright.request.newContext({ baseURL: process.env.BALANCE_E2E_URL });
    try {
      const challenge = await api.post("/api/login", { headers, data: {
        userId: identity.ref, password: identity.password,
      } });
      expect(challenge.status()).toBe(202);
      expect(challenge.headers()["access-control-allow-origin"]).toBe(origin);
      expect((await api.get("/api/accounts", { headers })).status()).toBe(401);
      const rejected = await api.post("/api/security/two-factor/challenge", {
        headers: { origin: "https://untrusted.replit.dev" }, data: { code: codes[0] },
      });
      expect(rejected.status()).toBe(403);
      expect(rejected.headers()["access-control-allow-origin"]).toBeUndefined();
      const verified = await api.post("/api/security/two-factor/challenge", { headers, data: { code: codes[0] } });
      expect(verified.status()).toBe(200);
      expect(verified.headers()["access-control-allow-origin"]).toBe(origin);
      expect((await api.get("/api/accounts", { headers })).status()).toBe(200);
      const status = await api.get("/api/security/status", { headers });
      expect(status.status()).toBe(200);
      const disabled = await api.post("/api/security/two-factor/disable", {
        headers, data: { currentPassword: identity.password, code: codes[1] },
      });
      expect(disabled.status()).toBe(200);
    } finally { await api.dispose(); }
  });
}

test("security setup, recovery sign-in and password change work through compact client dialogs", async ({ page, identity }) => {
  await login(page, identity);
  await page.goto("/settings");
  await page.getByRole("tab", { name: /security/i }).click();
  await page.getByTestId("security-setup-two-factor").click();
  let dialog = page.getByTestId("security-dialog");
  await dialog.getByLabel("Current password", { exact: true }).fill(identity.password);
  await dialog.getByRole("button", { name: "Continue", exact: true }).click();
  await dialog.getByText("Enter key manually").click();
  const secret = await dialog.getByLabel("Authenticator setup key").textContent();
  const code = await generate({ secret: secret! });
  await dialog.getByLabel("Six-digit authenticator code").fill(code);
  await dialog.getByRole("button", { name: /turn on|confirm|enable/i }).click();
  const recoveryDialog = page.getByRole("dialog").filter({ has: page.getByLabel("One-time recovery codes") });
  await expect(recoveryDialog).toBeVisible();
  const recoveryCodes = await recoveryDialog.locator("code").allTextContents();
  expect(recoveryCodes.length).toBe(10);
  await recoveryDialog.getByRole("button", { name: "Done", exact: true }).click();
  await expect(page.getByTestId("security-status")).toContainText("Enabled");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.request.post("/api/logout");
  await page.goto("/auth");
  await page.locator('input[name="userId"]').fill(identity.ref);
  await page.locator('input[name="password"]').fill(identity.password);
  await page.getByTestId("button-sign-in").click();
  await expect(page.getByTestId("mfa-login-code")).toBeVisible();
  expect((await page.request.get("/api/accounts")).status()).toBe(401);
  await page.getByTestId("mfa-login-code").fill(recoveryCodes[0]);
  await page.getByTestId("mfa-login-submit").click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto("/settings");
  await page.getByRole("tab", { name: /security/i }).click();
  await page.getByTestId("security-change-password").click();
  dialog = page.getByTestId("security-dialog");
  const changed = randomBytes(24).toString("hex");
  await dialog.getByLabel("Current password", { exact: true }).fill(identity.password);
  await dialog.getByLabel("New password", { exact: true }).fill(changed);
  await dialog.getByLabel("Confirm new password", { exact: true }).fill(changed);
  await dialog.getByLabel("Authenticator or recovery code").fill(recoveryCodes[1]);
  await dialog.getByRole("button", { name: "Change password", exact: true }).click();
  await expect(page).toHaveURL(/\/auth/);
  await expect(page.getByText("Your password has changed.", { exact: false })).toBeVisible();
  expect((await page.request.get("/api/user")).status()).toBe(401);
});

test("security enrollment and pending sign-in expire and attempts are limited", async ({ page, identity, db, playwright }) => {
  await login(page, identity);
  await page.close();
  let setup = await page.request.post("/api/security/two-factor/setup", { data: { currentPassword: identity.password } });
  const initial = await setup.json();
  const initialCode = await generate({ secret: initial.secret });
  await db.query("UPDATE client_security SET pending_expires=NOW()-INTERVAL '1 second' WHERE user_id=$1", [identity.userId]);
  expect((await page.request.post("/api/security/two-factor/confirm", { data: { code: initialCode } })).status()).toBe(400);
  setup = await page.request.post("/api/security/two-factor/setup", { data: { currentPassword: identity.password } });
  const fresh = await setup.json();
  expect((await page.request.post("/api/security/two-factor/confirm", { data: { code: await generate({ secret: fresh.secret }) } })).status()).toBe(200);
  const other = await playwright.request.newContext({ baseURL: process.env.BALANCE_E2E_URL });
  try {
    expect((await other.post("/api/login", { data: { userId: identity.ref, password: identity.password } })).status()).toBe(202);
    await db.query(`UPDATE session SET sess=jsonb_set(sess::jsonb,'{pendingMfa,expiresAt}','0'::jsonb)
      WHERE sess::jsonb->'pendingMfa'->>'userId'=$1`, [String(identity.userId)]);
    expect((await other.post("/api/security/two-factor/challenge", { data: { code: "000000" } })).status()).toBe(401);
    for (let index = 0; index < 8; index++) {
      expect((await other.post("/api/login", { data: { userId: identity.ref, password: "wrong" } })).status()).toBe(401);
    }
    expect((await other.post("/api/login", { data: { userId: identity.ref, password: "wrong" } })).status()).toBe(429);
    expect((await other.get("/api/accounts")).status()).toBe(401);
  } finally { await other.dispose(); }
});

test("security replacement recovery codes revoke old codes and concurrent reuse cannot grant two logins", async ({ page, identity, playwright }) => {
  await login(page, identity);
  await page.close();
  const setup = await (await page.request.post("/api/security/two-factor/setup", { data: { currentPassword: identity.password } })).json();
  const confirmation = await page.request.post("/api/security/two-factor/confirm", { data: { code: await generate({ secret: setup.secret }) } });
  expect(confirmation.status()).toBe(200);
  const original: string[] = (await confirmation.json()).recoveryCodes;
  const other = await playwright.request.newContext({ baseURL: process.env.BALANCE_E2E_URL });
  try {
    await other.post("/api/login", { data: { userId: identity.ref, password: identity.password } });
    expect((await other.post("/api/security/two-factor/challenge", { data: { code: original[0] } })).status()).toBe(200);
    const replacement = await page.request.post("/api/security/two-factor/recovery", { data: { currentPassword: identity.password, code: original[1] } });
    expect(replacement.status()).toBe(200);
    const codes: string[] = (await replacement.json()).recoveryCodes;
    expect(codes.length).toBe(10);
    expect((await other.get("/api/user")).status()).toBe(401);
    await other.post("/api/login", { data: { userId: identity.ref, password: identity.password } });
    expect((await other.post("/api/security/two-factor/challenge", { data: { code: original[2] } })).status()).toBe(400);
    const results = await Promise.all([
      other.post("/api/security/two-factor/challenge", { data: { code: codes[0] } }),
      other.post("/api/security/two-factor/challenge", { data: { code: codes[0] } }),
    ]);
    expect(results.filter(result => result.status() === 200).length).toBe(1);
    expect(results.every(result => [200, 400, 401].includes(result.status()))).toBe(true);
  } finally { await other.dispose(); }
});
