import { test, expect, login, verifyHeadline, HEADLINE } from "./fixtures";
import type { Page, TestInfo } from "@playwright/test";
import { readFile } from "node:fs/promises";

async function evidence(page: Page, info: TestInfo, name: string) {
  const path = info.outputPath(`${name}.png`);
  await page.screenshot({ path, fullPage: true });
  await info.attach(name, { path, contentType: "image/png" });
}

test.beforeEach(async ({ page }) => {
  // Keep every request local, including failures/malformed-response scenarios.
  await page.route("**/api/**", async route => {
    const url = new URL(route.request().url());
    expect(url.origin).toBe(process.env.BALANCE_E2E_URL);
    await route.continue();
  });
});

test.afterEach(async ({ page }, info) => {
  if (!page.isClosed()) await evidence(page, info, "final-browser-state");
});

test("normal login, funded headline, named debt, negative accounts and sixth positive account", async ({ page, identity }, info) => {
  await login(page, identity);
  await verifyHeadline(page);
  await expect(page.getByTestId("text-liquid-cash")).toHaveText("CAD $2,001,400.25");
  await expect(page.getByTestId("text-investment-value")).toHaveText("CAD $2,500.00");
  await expect(page.getByTestId("text-total-fee-debt")).toHaveText("CAD $1,614.39");
  const debt = page.getByRole("region", { name: "Outstanding service fees" });
  const link = debt.getByRole("link", { name: /Fee Reserve Trust: overdraft/ });
  await expect(link).toHaveAttribute("href", `/accounts/${identity.debt}`);
  await expect(link).toContainText("$1,250.75");
  await expect(link).toContainText("CAD $363.64 unpaid fees");
  const headlineBox = await page.getByTestId("text-total-balance").boundingBox();
  const debtBox = await debt.boundingBox();
  expect(debtBox!.y).toBeGreaterThan(headlineBox!.y);
  await expect(page.getByTestId(`dash-account-${identity.debt}`)).toContainText("-$1,250.75 cash");
  await expect(page.getByTestId(`dash-account-${identity.extra}`)).toContainText("$500.00 cash");
  await evidence(page, info, "signed-in-funded-balance-and-debt");
  // The sixth account is not in the dashboard's five-row preview but must count.
  await page.getByTestId("button-quick-accounts").click();
  await expect(page.getByTestId(`balance-${identity.sixth}`)).toHaveText("CAD $125.00");
  await expect(page.getByTestId(`balance-${identity.debt}`)).toHaveText("CAD -$1,250.75");
  await page.getByTestId(`balance-${identity.debt}`).scrollIntoViewIfNeeded();
  await expect(page.getByTestId(`balance-${identity.debt}`)).toBeVisible();
  await evidence(page, info, "negative-individual-account-balance");
  await page.goto("/dashboard");
  await verifyHeadline(page);
  await link.click();
  await expect(page).toHaveURL(new RegExp(`/accounts/${identity.debt}$`));
  await expect(page.getByRole("heading", { name: "Fee Reserve Trust", exact: true })).toBeVisible();
  await expect(page.getByTestId("text-posted-overdraft-ledger")).toContainText("-$1,250.75");
  await page.goto("/dashboard");
  await verifyHeadline(page);
  await page.reload();
  await verifyHeadline(page);
  const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(horizontalOverflow).toBe(false);
});

test("fee retry/refund and account/holding polling refresh without netting debt", async ({ page, identity, db }, info) => {
  await page.clock.install();
  await login(page, identity);
  await verifyHeadline(page);
  async function feeAction(action: string) {
    const result = await page.request.post(`/api/admin/fees/assessments/${identity.assessment}/${action}`, {
      headers: { "x-admin-key": process.env.BALANCE_E2E_ADMIN! },
      data: { confirmed: true, reason: "Isolated browser regression" },
    });
    expect(result.ok(), await result.text()).toBeTruthy();
  }
  // Enables processing ONLY in the temporary local cluster.
  const settings = await page.request.post("/api/admin/fees/settings", {
    headers: { "x-admin-key": process.env.BALANCE_E2E_ADMIN! }, data: { enabled: true, confirmed: true },
  });
  expect(settings.ok()).toBeTruthy();
  await feeAction("retry");
  await page.clock.runFor(31000);
  await expect(page.getByTestId(`dash-account-${identity.debt}`)).toContainText("-$1,614.39 cash");
  await expect(page.getByTestId("text-total-fee-debt")).toHaveText("CAD $1,614.39");
  await verifyHeadline(page);
  await evidence(page, info, "fee-posted-to-negative-ledger");
  await feeAction("refund");
  await page.clock.runFor(31000);
  await expect(page.getByTestId("text-total-fee-debt")).toHaveText("CAD $1,250.75");
  await expect(page.getByTestId(`dash-account-${identity.debt}`)).toContainText("-$1,250.75 cash");
  await verifyHeadline(page);
  await db.query("UPDATE accounts SET balance=balance+10 WHERE id=$1 AND user_id=$2", [identity.extra, identity.userId]);
  await db.query("UPDATE investments SET current_price=251 WHERE account_id=$1", [identity.funded]);
  await page.clock.runFor(31000);
  await verifyHeadline(page, "$2,003,920.25");
  await expect(page.getByTestId("text-liquid-cash")).toHaveText("CAD $2,001,410.25");
  await expect(page.getByTestId("text-investment-value")).toHaveText("CAD $2,510.00");
  await page.reload();
  await verifyHeadline(page, "$2,003,920.25");
});

test("pending deposits, internal transfer, and institutional status/navigation changes", async ({ page, identity, db }, info) => {
  await page.clock.install();
  await login(page, identity);
  await verifyHeadline(page);
  await expect(page.getByTestId(`txn-row-${identity.deposit}`)).toContainText("pending");
  await expect(page.getByText("CAD $9,000,000.00 pending", { exact: true })).toBeVisible();
  const transfer = await page.request.post("/api/transactions/transfer", {
    data: { fromAccountId: identity.funded, toAccountId: identity.extra, amount: "100.00" },
  });
  expect(transfer.status(), await transfer.text()).toBe(201);
  await page.clock.runFor(31000);
  await expect(page.getByTestId(`dash-account-${identity.extra}`)).toContainText("$600.00 cash");
  await verifyHeadline(page);
  const request = await page.request.post("/api/institutional-transfers", { data: {
    institutionName: "Isolated Test Institution", institutionAccountNumber: "TEST-NOT-REAL",
    accountType: "Brokerage Account", transferType: "cash", transferScope: "full",
    accountId: identity.funded,
  } });
  expect(request.status(), await request.text()).toBe(200);
  const record = await request.json();
  for (const status of ["pending", "under_review", "approved", "liquidating", "transfer_out", "completed", "rejected"]) {
    await db.query("UPDATE institutional_transfers SET status=$1 WHERE id=$2 AND user_id=$3",
      [status, record.id, identity.userId]);
    await page.clock.runFor(16000);
    await verifyHeadline(page);
    await expect(page.getByTestId("text-total-fee-debt")).toHaveText("CAD $1,614.39");
    if (status === "transfer_out") {
      await expect(page.getByText("Funds in transit to Isolated Test Institution")).toBeVisible();
      await evidence(page, info, "funds-in-transit-retain-funded-headline");
    }
    if (["approved", "liquidating", "transfer_out"].includes(status)) {
      await expect(page.getByText("CAD $9,000,000.00 pending · Transfer locked", { exact: true })).toBeVisible();
    }
    await page.goto("/transfers");
    if (status === "rejected") {
      // Current transfer list deliberately omits rejected requests.
      await expect(page.getByTestId(`inst-transfer-${record.id}`)).toHaveCount(0);
      await expect(page.getByText("No transfer requests yet")).toBeVisible();
    } else {
      await expect(page.getByTestId(`inst-transfer-${record.id}`)).toBeVisible();
    }
    await page.goto("/dashboard");
    await verifyHeadline(page);
  }
  await db.query("UPDATE transactions SET status='failed' WHERE id=$1 AND to_account_id=$2", [identity.deposit, identity.funded]);
  await page.clock.runFor(31000);
  await expect(page.getByTestId(`txn-row-${identity.deposit}`)).toContainText("failed");
  await expect(page.getByText("CAD $9,000,000.00 pending", { exact: true })).toHaveCount(0);
  await verifyHeadline(page);
  // Only ledger posting, not transaction status, changes funded assets.
  await db.query("UPDATE accounts SET balance=balance+9000000 WHERE id=$1 AND user_id=$2", [identity.funded, identity.userId]);
  await db.query("UPDATE transactions SET status='completed' WHERE id=$1 AND to_account_id=$2", [identity.deposit, identity.funded]);
  await page.clock.runFor(31000);
  await verifyHeadline(page, "$11,003,900.25");
  await expect(page.getByTestId(`txn-row-${identity.deposit}`)).toContainText("completed");
});

test("loading, request failures, malformed balances and recovery do not show fabricated totals", async ({ page, identity }, info) => {
  await page.clock.install();
  let release!: () => void;
  const held = new Promise<void>(done => { release = done; });
  await page.route("**/api/accounts", async route => { await held; await route.continue(); });
  await login(page, identity);
  await expect(page.getByTestId("text-total-balance")).toHaveCount(0);
  await evidence(page, info, "loading-without-fabricated-balance");
  release();
  await verifyHeadline(page);
  await page.unroute("**/api/accounts");
  for (const endpoint of ["accounts", "investments"]) {
    await page.route(`**/api/${endpoint}`, route => route.fulfill({ status: 503, json: { message: "Injected isolated failure" } }));
    // Failed polling must not continue displaying a stale funded headline.
    await page.clock.runFor(31000);
    await verifyHeadline(page, "Unavailable");
    await evidence(page, info, `${endpoint}-poll-failure-hides-stale-total`);
    await page.reload();
    await verifyHeadline(page, "Unavailable");
    await expect(page.getByRole("alert").filter({ hasText: "Current balances could not be loaded" })).toBeVisible();
    await page.unroute(`**/api/${endpoint}`);
    await page.getByRole("button", { name: "Retry", exact: true }).click();
    await verifyHeadline(page);
  }
  await page.route("**/api/fees/summary", route => route.fulfill({ status: 503, json: { message: "Injected fee failure" } }));
  await page.reload();
  await verifyHeadline(page);
  await expect(page.getByRole("alert").filter({ hasText: "fee details could not be loaded" })).toBeVisible();
  await page.unroute("**/api/fees/summary");
  await page.getByRole("button", { name: /retry/i }).click();
  await expect(page.getByTestId("text-total-fee-debt")).toHaveText("CAD $1,614.39");
  await page.route("**/api/accounts", async route => {
    const response = await route.fetch();
    const accounts = await response.json();
    accounts[0].balance = "invalid";
    await route.fulfill({ json: accounts });
  });
  await page.reload();
  await verifyHeadline(page, "Unavailable");
  await page.unroute("**/api/accounts");
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await verifyHeadline(page);
});

test("existing accounts privacy control masks cash, fee debt and named ledger details", async ({ page, identity }, info) => {
  await login(page, identity);
  await verifyHeadline(page);
  await page.getByTestId("button-quick-accounts").click();
  await expect(page.getByTestId("text-total-fee-debt")).toHaveText("CAD $1,614.39");
  await page.getByTestId("button-toggle-balances").click();
  await expect(page.getByTestId("text-total-balance")).not.toContainText("$");
  await expect(page.getByTestId("text-total-fee-debt")).toHaveText("••••••");
  await expect(page.getByTestId(`balance-${identity.debt}`)).not.toContainText("$");
  await expect(page.getByTestId(`balance-${identity.sixth}`)).not.toContainText("$");
  await expect(page.getByRole("region", { name: "Outstanding service fees" })).not.toContainText("$");
  await expect(page.getByTestId("text-fee-overdraft").first()).not.toContainText("$");
  await evidence(page, info, "accounts-privacy-masks-balances-and-debt");
  await page.getByTestId("button-toggle-balances").click();
  await expect(page.getByTestId(`balance-${identity.debt}`)).toHaveText("CAD -$1,250.75");
  await expect(page.getByTestId(`balance-${identity.sixth}`)).toHaveText("CAD $125.00");
  await page.goto("/dashboard");
  await verifyHeadline(page, HEADLINE);
});

test("clients cannot relabel CAD ledgers through profile updates", async ({ page, identity, db }) => {
  await login(page, identity);
  await verifyHeadline(page);
  for (const displayCurrency of ["GBP", "CAD", null, "USD"]) {
    const result = await page.request.patch("/api/user", { data: { displayCurrency } });
    expect(result.status()).toBe(403);
    expect(await result.json()).toMatchObject({ message: expect.stringContaining("cannot be changed") });
  }
  const { rows: [user] } = await db.query("SELECT display_currency FROM users WHERE id=$1 AND client_ref=$2",
    [identity.userId, identity.ref]);
  expect(user.display_currency).toBe("CAD");
  await page.reload();
  await verifyHeadline(page);
  await expect(page.getByTestId("text-total-fee-debt")).toHaveText("CAD $1,614.39");
  await page.getByRole("link", { name: /Fee Reserve Trust: overdraft/ }).click();
  await expect(page.getByText("Account ledger cash less unpaid assessments · CAD", { exact: true })).toBeVisible();
  await expect(page.getByTestId("text-posted-overdraft-ledger")).toHaveText("CAD -$1,250.75 posted negative cash ledger");
});

test("preconfigured pound exception preserves amounts and consistent detail/debt labels without changing CAD clients", async ({ page, identity, db, browser }, info) => {
  const cadRef = `${identity.ref}-CAD`;
  const { rows: [ordinary] } = await db.query(
    `INSERT INTO users(client_ref,email,name,password)
     SELECT $1,$2,'Ordinary CAD Test Client',password FROM users WHERE id=$3 AND client_ref=$4 RETURNING id`,
    [cadRef, `${cadRef.toLowerCase()}@example.invalid`, identity.userId, identity.ref]);
  await db.query("INSERT INTO accounts(user_id,account_type,display_name,balance) VALUES($1,'Brokerage Account','CAD Counterpart',100)", [ordinary.id]);
  const priorCurrencies = await db.query("SELECT id,display_currency FROM users WHERE id<>$1 ORDER BY id", [identity.userId]);
  // Simulate an already explicitly designated exception on our disposable
  // identity, not Mary or an existing client. Still sign in normally afterward.
  await db.query("UPDATE users SET display_currency='GBP' WHERE id=$1 AND client_ref=$2",
    [identity.userId, identity.ref]);
  await login(page, identity);
  await verifyHeadline(page, "£2,003,900.25");
  await expect(page.getByTestId("text-liquid-cash")).toHaveText("£2,001,400.25");
  await expect(page.getByTestId("text-investment-value")).toHaveText("£2,500.00");
  await expect(page.getByTestId("text-total-fee-debt")).toHaveText("£1,614.39");
  await expect(page.getByTestId(`dash-account-${identity.debt}`)).toContainText("-£1,250.75 cash");
  await evidence(page, info, "preconfigured-pound-exception-funded-balance-and-debt");
  await page.getByTestId("button-quick-accounts").click();
  await expect(page.getByTestId(`balance-${identity.sixth}`)).toHaveText("£125.00");
  await expect(page.getByTestId(`balance-${identity.debt}`)).toHaveText("-£1,250.75");
  await page.getByRole("link", { name: /Fee Reserve Trust: overdraft/ }).click();
  await expect(page.getByText("Account ledger cash less unpaid assessments · £", { exact: true })).toBeVisible();
  const debt = page.getByRole("region", { name: "Outstanding service fees" });
  await expect(debt).toContainText("£1,614.39");
  await expect(debt).not.toContainText("CAD");
  await expect(debt).not.toContainText("GBP");
  await expect(page.getByTestId("text-posted-overdraft-ledger")).toHaveText("-£1,250.75 posted negative cash ledger");
  await evidence(page, info, "pound-account-detail-consistent-debt-and-ledger");
  await page.goto(`/accounts/${identity.funded}`);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export", exact: true }).click();
  const csv = await readFile(await (await download).path(), "utf8");
  expect(csv).toContain("Amount (£)");
  expect(csv).toContain('"9000000"');
  expect(csv).not.toContain("Amount (CAD)");
  await page.reload();
  await expect(page.getByText("Account ledger cash less unpaid assessments · £", { exact: true })).toBeVisible();
  await page.goto("/dashboard");
  await verifyHeadline(page, "£2,003,900.25");
  const otherClients = await db.query("SELECT id,display_currency FROM users WHERE id<>$1 ORDER BY id", [identity.userId]);
  // Prior ordinary fixtures remain CAD; do not touch them to configure this exception.
  expect(otherClients.rows).toEqual(priorCurrencies.rows);
  const { rows: [account] } = await db.query("SELECT balance FROM accounts WHERE id=$1 AND user_id=$2",
    [identity.funded, identity.userId]);
  expect(account.balance).toBe("2000000.25");
  const context = await browser.newContext({ baseURL: process.env.BALANCE_E2E_URL, viewport: page.viewportSize()! });
  try {
    const cadPage = await context.newPage();
    await login(cadPage, { ...identity, userId: ordinary.id, ref: cadRef });
    await verifyHeadline(cadPage, "CAD $100.00");
    await expect(cadPage.getByTestId("text-total-balance")).not.toContainText("£");
  } finally {
    await context.close();
  }
});
