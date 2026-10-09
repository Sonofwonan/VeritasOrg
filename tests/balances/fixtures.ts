import { test as base, expect, type Page } from "@playwright/test";
import { randomBytes, scryptSync } from "node:crypto";
import pg from "pg";
import { writeFile } from "node:fs/promises";
import { DEFAULT_FEE_COMPONENTS, OVERDRAFT_FEE_TERMS } from "../../shared/fees";

export const HEADLINE = "CAD $2,003,900.25";
export type Identity = {
  userId: number; ref: string; password: string; debt: number; funded: number;
  extra: number; sixth: number; assessment: number; deposit: number;
};

function isolatedDatabase() {
  const connectionString = process.env.BALANCE_E2E_DATABASE!;
  const url = new URL(connectionString);
  if (url.hostname !== "127.0.0.1" || url.pathname !== "/veritas_balance_e2e" ||
      url.username !== "balance_test" || !url.port || url.searchParams.get("sslmode") !== "disable") {
    throw new Error("Refusing fixture access to a non-isolated database");
  }
  return new pg.Pool({ connectionString });
}

export const test = base.extend<{ identity: Identity; db: pg.Pool; browserEvidence: void }>({
  browserEvidence: [async ({ page }, use, info) => {
    const errors: string[] = [];
    const consoleMessages: { type: string; text: string }[] = [];
    const failedRequests: { path: string; status: number; expected: boolean }[] = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => {
      if (["error", "warning"].includes(message.type())) {
        consoleMessages.push({ type: message.type(), text: message.text() });
      }
    });
    page.on("response", response => {
      if (response.status() < 400) return;
      const path = new URL(response.url()).pathname;
      const expected = (path === "/api/user" && response.status() === 401) ||
        (info.title.startsWith("clients cannot") && path === "/api/user" && response.status() === 403) ||
        (info.title.startsWith("loading,") && response.status() === 503);
      failedRequests.push({ path, status: response.status(), expected });
    });
    await use();
    const path = info.outputPath("browser-errors.json");
    await writeFile(path, JSON.stringify({ errors, consoleMessages, failedRequests }, null, 2));
    await info.attach("browser-errors", { path, contentType: "application/json" });
    expect(errors, "Uncaught browser errors").toEqual([]);
    expect(failedRequests.filter(r => !r.expected), "Unexpected HTTP failures").toEqual([]);
    // Browser-generated resource errors are recorded above; all other console
    // errors are unexpected. Warnings (including existing React warnings) are evidence.
    expect(consoleMessages.filter(m => m.type === "error" &&
      !/Failed to load resource:.*(?:401|503)/.test(m.text)), "Unexpected console errors").toEqual([]);
  }, { auto: true }],
  db: async ({}, use) => {
    const db = isolatedDatabase();
    const { rows: [row] } = await db.query("SELECT current_database() AS name, current_user AS role");
    expect(row).toEqual({ name: "veritas_balance_e2e", role: "balance_test" });
    await use(db);
    await db.end();
  },
  identity: async ({ db }, use) => {
    const suffix = randomBytes(8).toString("hex");
    const password = randomBytes(24).toString("hex");
    const salt = randomBytes(16).toString("hex");
    const hash = `${scryptSync(password, salt, 64).toString("hex")}.${salt}`;
    const ref = `E2E-${suffix}`;
    const { rows: [user] } = await db.query(
      "INSERT INTO users(client_ref,email,name,password) VALUES($1,$2,'Balance Test Client',$3) RETURNING id",
      [ref, `${suffix}@example.invalid`, hash]);
    const ids: number[] = [];
    const records = [
      ["Trust Account", "Fee Reserve Trust", "-1250.75"],
      ["Brokerage Account", "Funded Brokerage", "2000000.25"],
      ["Roth IRA", "Retirement Savings", "500.00"],
      ["Traditional IRA", "Additional Retirement", "750.00"],
      ["529 Savings Plan", "Education Fund", "25.00"],
      ["Trust Account", "Sixth Positive Account", "125.00"],
    ];
    for (const [type, name, balance] of records) {
      const { rows: [account] } = await db.query(
        "INSERT INTO accounts(user_id,account_type,display_name,balance,is_demo) VALUES($1,$2,$3,$4,true) RETURNING id",
        [user.id, type, name, balance]);
      ids.push(account.id);
    }
    await db.query("INSERT INTO investments(account_id,symbol,shares,purchase_price,current_price) VALUES($1,'TEST',10,200,250)", [ids[1]]);
    const { rows: [deposit] } = await db.query(
      `INSERT INTO transactions(to_account_id,amount,description,transaction_type,status)
       VALUES($1,9000000,'Pending test deposit','transfer','pending') RETURNING id`, [ids[1]]);
    // Dedicated, authorized overdraft plan. No existing plan/settings are reused.
    const { rows: [schedule] } = await db.query(
      `INSERT INTO fee_schedules(name,version,components,total,terms,funding)
       SELECT $1,MAX(version)+1,$2::jsonb,363.64,$3,'fee_overdraft' FROM fee_schedules RETURNING id`,
      [`Isolated ${suffix}`, JSON.stringify(DEFAULT_FEE_COMPONENTS), OVERDRAFT_FEE_TERMS]);
    const { rows: [enrollment] } = await db.query(
      `INSERT INTO fee_enrollments(account_id,user_id,schedule_id,state,first_charge_date,accepted_at,accepted_by)
       VALUES($1,$2,$3,'active','2026-01-01','2025-12-01',$2) RETURNING id`, [ids[0], user.id, schedule.id]);
    const { rows: [assessment] } = await db.query(
      `INSERT INTO fee_assessments(enrollment_id,account_id,period,due_date,components,total,status,funding)
       VALUES($1,$2,0,'2026-01-01',$3::jsonb,363.64,'unpaid','fee_overdraft') RETURNING id`,
      [enrollment.id, ids[0], JSON.stringify(DEFAULT_FEE_COMPONENTS)]);
    await use({ userId: user.id, ref, password, debt: ids[0], funded: ids[1], extra: ids[2],
      sixth: ids[5], assessment: assessment.id, deposit: deposit.id });
    // No row cleanup: immutable fee history stays in the disposable cluster.
    // The runner destroys only the cluster it created, even after test failure.
  },
});
export { expect };

export async function login(page: Page, identity: Identity) {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/auth$/);
  await page.getByPlaceholder("e.g. VW-440FR", { exact: true }).fill(identity.ref);
  await page.locator('input[name="password"]').fill(identity.password);
  const response = page.waitForResponse(r => r.url().endsWith("/api/login") && r.request().method() === "POST");
  await page.getByTestId("button-sign-in").click();
  expect((await response).status()).toBe(200);
  await expect(page).toHaveURL(/\/dashboard$/);
  const cookies = await page.context().cookies();
  expect(cookies.some(cookie => cookie.name === "connect.sid" && cookie.httpOnly)).toBeTruthy();
}

export async function verifyHeadline(page: Page, value = HEADLINE) {
  await expect(page.getByTestId("text-total-balance")).toHaveText(value.startsWith("$") ? `CAD ${value}` : value);
}
