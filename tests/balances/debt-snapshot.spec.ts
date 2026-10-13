import { test, expect, login, verifyHeadline, assertFundsActionBlocked } from "./fixtures";
import { FeeService } from "../../server/fees/service";
import { approvePayment } from "../../server/funds-access";
import type { Pool, PoolClient } from "pg";
import type { ClientAccountSnapshot } from "../../shared/fees";
import type { Route } from "@playwright/test";

async function figures(page: import("@playwright/test").Page, debt: number, overdraft: string, owed: string) {
  await expect(page.getByTestId("text-overdraft")).toHaveText(`CAD -$${overdraft}`);
  await expect(page.getByTestId("text-unpaid-fees")).toHaveText(`CAD -$${owed}`);
  await expect(page.getByTestId(`debt-account-amount-${debt}`)).toHaveText(`CAD -$${owed}`);
  await expect(page.getByTestId(`dash-account-${debt}`)).toContainText(`CAD -$${overdraft}`);
  await verifyHeadline(page);
}

test("database snapshot stays consistent when settlement, refund and payment commit between reads", async ({ db, identity }) => {
  await db.query("UPDATE fee_settings SET enabled=true");
  await db.query("UPDATE users SET debt_clearance_required=true,debt_payment_account_id=$2 WHERE id=$1", [identity.userId, identity.debt]);
  const service = new FeeService(db);
  const { rows: [payment] } = await db.query(
    `INSERT INTO transactions(to_account_id,amount,description,transaction_type,status)
     VALUES($1,500,'Isolated debt payment','transfer','pending') RETURNING id`, [identity.debt]);
  for (const action of [
    () => service.assessmentAction(identity.assessment, "retry", "Isolated snapshot settlement"),
    () => service.assessmentAction(identity.assessment, "refund", "Isolated snapshot refund"),
    () => approvePayment(db, payment.id),
  ]) {
    const before = await service.clientAccountSnapshot(identity.userId);
    let interleaved = false;
    // Commit on another connection after the cash read but before the liability
    // read. READ COMMITTED would combine different states here.
    const reader = new Proxy(db, {
      get(target, property) {
        if (property !== "connect") return Reflect.get(target, property);
        return async () => {
          const client = await target.connect();
          return new Proxy(client, {
            get(connection, key) {
              if (key !== "query") return Reflect.get(connection, key);
              return async (sql: string, params?: unknown[]) => {
                const result = await connection.query(sql, params);
                if (sql.startsWith("SELECT * FROM accounts WHERE")) {
                  await action();
                  interleaved = true;
                }
                return result;
              };
            },
          }) as PoolClient;
        };
      },
    }) as Pool;
    const during = await new FeeService(reader).clientAccountSnapshot(identity.userId);
    expect(interleaved).toBe(true);
    expect(during).toEqual(before);
    const after = await service.clientAccountSnapshot(identity.userId);
    expect(after).not.toEqual(before);
    expect(Number(after.feeSummary.totalOverdraft)).toBe(
      after.accounts.reduce((sum, account) => sum + Math.max(0, -Number(account.balance)), 0));
    expect(Number(after.feeSummary.totalOwed)).toBeCloseTo(
      Number(after.feeSummary.totalOverdraft) + Number(after.feeSummary.totalUnpaid), 8);
  }
});

test("delayed snapshots never mix dashboard debt figures during settlement, refund or payment", async ({ page, db, identity }) => {
  await page.clock.install();
  await db.query("UPDATE users SET debt_clearance_required=true,debt_payment_account_id=$2 WHERE id=$1", [identity.userId, identity.debt]);
  await db.query("UPDATE fee_settings SET enabled=true");
  await login(page, identity);
  await figures(page, identity.debt, "1,250.75", "1,614.39");
  await assertFundsActionBlocked(page, "button-quick-transfer");
  const admin = { "x-admin-key": process.env.BALANCE_E2E_ADMIN! };
  const { rows: [payment] } = await db.query(
    `INSERT INTO transactions(to_account_id,amount,description,transaction_type,status)
     VALUES($1,500,'Isolated debt payment','transfer','pending') RETURNING id`, [identity.debt]);
  const phases = [
    { path: `/api/admin/fees/assessments/${identity.assessment}/retry`, old: ["1,250.75", "1,614.39"], next: ["1,614.39", "1,614.39"] },
    { path: `/api/admin/fees/assessments/${identity.assessment}/refund`, old: ["1,614.39", "1,614.39"], next: ["1,250.75", "1,250.75"] },
    { path: `/api/admin/transactions/${payment.id}/approve`, old: ["1,250.75", "1,250.75"], next: ["750.75", "750.75"] },
  ];
  for (const phase of phases) {
    let release!: () => void;
    let captured!: () => void;
    const held = new Promise<void>(done => { release = done; });
    const ready = new Promise<void>(done => { captured = done; });
    let requests = 0;
    const handler = async (route: Route) => {
      requests++;
      const response = await route.fetch();
      captured();
      await held;
      await route.fulfill({ response });
    };
    await page.route("**/api/accounts/snapshot", handler);
    await page.clock.runFor(31000);
    await ready;
    const response = await page.request.post(phase.path, { headers: admin,
      data: { confirmed: true, reason: "Isolated delayed response regression" } });
    expect(response.ok(), await response.text()).toBe(true);
    await page.clock.runFor(31000);
    // Another poll must not overlap a pending request for this snapshot.
    expect(requests).toBe(1);
    await figures(page, identity.debt, phase.old[0], phase.old[1]);
    const delivered = page.waitForResponse(r => r.url().endsWith("/api/accounts/snapshot"));
    release();
    await delivered;
    await page.unroute("**/api/accounts/snapshot", handler);
    await figures(page, identity.debt, phase.old[0], phase.old[1]);
    await page.clock.runFor(31000);
    await figures(page, identity.debt, phase.next[0], phase.next[1]);
    await assertFundsActionBlocked(page, "button-quick-transfer");
  }
  expect((await db.query("SELECT balance FROM accounts WHERE id=$1", [identity.debt])).rows[0].balance).toBe("-750.75");
  expect((await db.query("SELECT debt_payment_confirmed_at FROM users WHERE id=$1", [identity.userId])).rows[0].debt_payment_confirmed_at).not.toBeNull();
});

test("late independent account and fee responses cannot overwrite a newer dashboard snapshot", async ({ page, db, identity }) => {
  await page.clock.install();
  await login(page, identity);
  await figures(page, identity.debt, "1,250.75", "1,614.39");
  const before = await (await page.request.get("/api/accounts/snapshot")).json() as ClientAccountSnapshot;
  let release!: () => void;
  const held = new Promise<void>(done => { release = done; });
  await page.route("**/api/accounts", async route => { await held; await route.fulfill({ json: before.accounts }); });
  await page.route("**/api/fees/summary", async route => { await held; await route.fulfill({ json: before.feeSummary }); });
  // Deliberately deliver the legacy independent reads after the combined read.
  const legacy = page.evaluate(() => Promise.all([
    fetch("/api/accounts").then(r => r.json()), fetch("/api/fees/summary").then(r => r.json()),
  ]));
  await db.query("UPDATE fee_settings SET enabled=true");
  const posted = await page.request.post(`/api/admin/fees/assessments/${identity.assessment}/retry`, {
    headers: { "x-admin-key": process.env.BALANCE_E2E_ADMIN! },
    data: { confirmed: true, reason: "Isolated reordered response regression" },
  });
  expect(posted.ok()).toBe(true);
  await page.clock.runFor(31000);
  await figures(page, identity.debt, "1,614.39", "1,614.39");
  release();
  await legacy;
  await figures(page, identity.debt, "1,614.39", "1,614.39");
});

test("cancelled older snapshot responses cannot replace newer reads after settlement, refund or payment", async ({ page, db, identity }) => {
  test.setTimeout(90000);
  await page.clock.install();
  await db.query("UPDATE fee_settings SET enabled=true");
  await login(page, identity);
  await figures(page, identity.debt, "1,250.75", "1,614.39");
  const { rows: [payment] } = await db.query(
    `INSERT INTO transactions(to_account_id,amount,description,transaction_type,status)
     VALUES($1,500,'Isolated reordered payment','transfer','pending') RETURNING id`, [identity.debt]);
  for (const [path, overdraft, owed] of [
    [`/api/admin/fees/assessments/${identity.assessment}/retry`, "1,614.39", "1,614.39"],
    [`/api/admin/fees/assessments/${identity.assessment}/refund`, "1,250.75", "1,250.75"],
    [`/api/admin/transactions/${payment.id}/approve`, "750.75", "750.75"],
  ]) {
    let capture!: () => void;
    let release!: () => void;
    let finish!: () => void;
    const ready = new Promise<void>(done => { capture = done; });
    const held = new Promise<void>(done => { release = done; });
    const finished = new Promise<void>(done => { finish = done; });
    let requests = 0;
    const handler = async (route: Route) => {
      if (++requests > 1) return route.continue();
      const response = await route.fetch();
      capture();
      await held;
      await route.fulfill({ response });
      finish();
    };
    await page.route("**/api/accounts/snapshot", handler);
    await page.clock.runFor(31000);
    await ready;
    const posted = await page.request.post(path, {
      headers: { "x-admin-key": process.env.BALANCE_E2E_ADMIN! },
      data: { confirmed: true, reason: "Isolated cancelled snapshot regression" },
    });
    expect(posted.ok(), await posted.text()).toBe(true);
    // Client-side navigation unmounts the observer and aborts the old fetch.
    // Returning starts a newer read while the route still holds the old body.
    await page.getByTestId("button-quick-accounts").click();
    await expect(page).toHaveURL(/\/accounts$/);
    await page.goBack();
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.clock.runFor(31000);
    await figures(page, identity.debt, overdraft, owed);
    expect(requests).toBeGreaterThan(1);
    release();
    await finished;
    await page.unroute("**/api/accounts/snapshot", handler);
    await figures(page, identity.debt, overdraft, owed);
  }
});
