import { test, expect, login, verifyHeadline } from "./fixtures";
import type pg from "pg";

// The runner owns a disposable local cluster; never run against shared clients.
async function financialSnapshot(db: pg.Pool) {
  const { rows } = await db.query(`SELECT tablename FROM pg_tables WHERE schemaname='public'
    AND tablename NOT IN ('users','session','client_display_currency_audit') ORDER BY tablename`);
  const result: Record<string, unknown> = {};
  for (const { tablename } of rows) {
    if (!/^[a-z_]+$/.test(tablename)) throw new Error("Unexpected table name");
    result[tablename] = (await db.query(`SELECT to_jsonb(t) AS record FROM "${tablename}" t ORDER BY to_jsonb(t)::text`)).rows;
  }
  return result;
}

test("staff currency API rejects unauthorized, unsupported and unconfirmed changes and preserves financial records", async ({ page, identity, db }) => {
  const path = `/api/admin/users/${identity.userId}/display-currency`;
  const body = { displayCurrency: "GBP", expectedDisplayCurrency: "CAD", confirmed: true, reason: "Synthetic display designation" };
  const headers = { "x-admin-key": process.env.BALANCE_E2E_ADMIN! };
  const before = await financialSnapshot(db);
  const usersBefore = (await db.query("SELECT * FROM users ORDER BY id")).rows;
  expect((await page.request.patch(path, { data: body })).status()).toBe(401);
  expect((await page.request.patch(path, { headers: { "x-admin-key": "invalid" }, data: body })).status()).toBe(401);
  for (const data of [
    { ...body, displayCurrency: "USD" }, { ...body, expectedDisplayCurrency: "USD" },
    { ...body, confirmed: false }, { ...body, confirmed: undefined },
    { ...body, reason: " " }, { ...body, reason: "x".repeat(501) },
    { ...body, balance: "0.00" },
  ]) expect((await page.request.patch(path, { headers, data })).status()).toBe(400);
  expect((await page.request.patch("/api/admin/users/nope/display-currency", { headers, data: body })).status()).toBe(400);
  expect((await page.request.patch("/api/admin/users/2147483647/display-currency", { headers, data: body })).status()).toBe(404);
  expect((await db.query("SELECT * FROM client_display_currency_audit WHERE user_id=$1", [identity.userId])).rows).toHaveLength(0);

  const response = await page.request.patch(path, { headers, data: body });
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ id: identity.userId, displayCurrency: "GBP" });
  expect((await page.request.patch(path, { headers, data: body })).status()).toBe(409);
  expect((await page.request.patch(path, { headers, data: { ...body, expectedDisplayCurrency: "GBP" } })).status()).toBe(409);
  expect(await financialSnapshot(db)).toEqual(before);
  const usersAfter = (await db.query("SELECT * FROM users ORDER BY id")).rows;
  expect(usersAfter).toEqual(usersBefore.map(user => user.id === identity.userId ? { ...user, display_currency: "GBP" } : user));
  const audit = await page.request.get(`${path}/audit`, { headers });
  expect(audit.status()).toBe(200);
  const entries = await audit.json();
  expect(entries).toHaveLength(1);
  expect(entries[0]).toMatchObject({ actor: "admin", previousCurrency: "CAD", displayCurrency: "GBP",
    confirmed: true, presentationOnly: true, reason: body.reason });
  await expect(db.query("UPDATE client_display_currency_audit SET reason='rewrite' WHERE id=$1", [entries[0].id])).rejects.toThrow("immutable");
  await expect(db.query("DELETE FROM client_display_currency_audit WHERE id=$1", [entries[0].id])).rejects.toThrow("immutable");
  expect((await page.request.patch(path, { headers, data: { ...body, expectedDisplayCurrency: "GBP", displayCurrency: "CAD" } })).status()).toBe(200);
  expect(await financialSnapshot(db)).toEqual(before);
});

test("staff currency audit failure rolls back the preference", async ({ page, identity, db }) => {
  const before = await financialSnapshot(db);
  await db.query(`ALTER TABLE client_display_currency_audit ADD CONSTRAINT test_audit_failure
    CHECK (reason <> 'Synthetic audit failure')`);
  try {
    const response = await page.request.patch(`/api/admin/users/${identity.userId}/display-currency`, {
      headers: { "x-admin-key": process.env.BALANCE_E2E_ADMIN! },
      data: { displayCurrency: "GBP", expectedDisplayCurrency: "CAD", confirmed: true, reason: "Synthetic audit failure" },
    });
    expect(response.status()).toBe(500);
    expect((await db.query("SELECT display_currency FROM users WHERE id=$1", [identity.userId])).rows[0].display_currency).toBe("CAD");
    expect((await db.query("SELECT * FROM client_display_currency_audit WHERE user_id=$1", [identity.userId])).rows).toHaveLength(0);
    expect(await financialSnapshot(db)).toEqual(before);
  } finally { await db.query("ALTER TABLE client_display_currency_audit DROP CONSTRAINT test_audit_failure"); }
});

test("staff can deliberately change a client display and see named masked balances without changing fee pricing", async ({ page, identity, db, browser }, info) => {
  // Two real sessions: a client already viewing their dashboard and normal admin login.
  const context = await browser.newContext({ baseURL: process.env.BALANCE_E2E_URL, viewport: page.viewportSize()! });
  const client = await context.newPage();
  try {
    await login(client, identity);
    await verifyHeadline(client);
    const before = await financialSnapshot(db);
    await page.goto("/admin");
    await page.getByTestId("input-admin-password").fill(process.env.BALANCE_E2E_ADMIN!);
    await page.getByTestId("button-admin-login").click();
    await page.getByRole("tab", { name: /Users/ }).click();
    const row = page.getByTestId(`user-row-${identity.userId}`);
    await expect(row).toContainText("CAD display");
    await row.getByRole("button", { name: "Display & accounts" }).click();
    let panel = page.getByRole("dialog", { name: "Client display currency" });
    await expect(panel).toContainText("Presentation only — no conversion");
    await expect(panel).toContainText("pricing agreements");
    await expect(panel).toContainText("actual transfer settlement");
    await expect(panel.getByText("Funded Brokerage", { exact: true })).toBeVisible();
    await expect(panel).toContainText("CAD $2,000,000.25");
    await expect(panel).toContainText("Fee Reserve Trust: overdraft");
    await panel.getByRole("button", { name: "Hide balances" }).click();
    await expect(panel).not.toContainText("2,000,000.25");
    await expect(panel).not.toContainText("1,250.75");
    await expect(panel).not.toContainText("363.64");
    await panel.getByRole("button", { name: "Show balances" }).click();
    await panel.getByRole("button", { name: "£ Pound", exact: false }).click();
    const save = panel.getByRole("button", { name: "Save display preference" });
    await expect(save).toBeDisabled();
    await panel.getByLabel("Reason for change").fill("Synthetic administrator presentation designation");
    await expect(save).toBeDisabled();
    await panel.getByRole("checkbox").check();
    await save.click();
    await expect(panel).not.toBeVisible();
    await expect(row).toContainText("£ display");
    await expect(row).toContainText("£2,000,149.50");
    await row.getByRole("button", { name: "Display & accounts" }).click();
    panel = page.getByRole("dialog", { name: "Client display currency" });
    await expect(panel).toContainText("£2,000,000.25");
    await expect(panel).toContainText("Cash ledger overdraft -£1,250.75");
    await expect(panel).toContainText("Synthetic administrator presentation designation");
    await expect(panel).toContainText("CAD → £");
    const shot = info.outputPath("staff-pound-display.png");
    await page.screenshot({ path: shot, animations: "disabled" });
    const bounds = await panel.boundingBox();
    expect(bounds!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    await info.attach("staff-pound-display", { path: shot, contentType: "image/png" });
    await panel.getByRole("button", { name: "Cancel" }).click();
    await page.getByRole("tab", { name: /Fees/ }).click();
    await expect(page.getByText("Monthly total · CAD", { exact: true })).toBeVisible();
    await expect(page.getByText("CAD $363.64", { exact: true }).first()).toBeVisible();
    expect(await financialSnapshot(db)).toEqual(before);

    // The signed-in client receives the updated profile without logging out.
    await client.goto("/accounts");
    await expect(client.getByTestId(`balance-${identity.funded}`)).toHaveText("£2,000,000.25");
    await client.goto("/dashboard");
    await verifyHeadline(client, "£2,003,900.25");
    await expect(client.getByTestId("text-total-fee-debt")).toHaveText("£1,614.39");
    await expect(client.locator("body")).not.toContainText("GBP");
    await expect(client.locator("body")).not.toContainText("CAD");
  } finally { await context.close(); }
});
