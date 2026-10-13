import { test, expect, login, assertFundsActionBlocked, type Identity } from "./fixtures";
import type { Page } from "@playwright/test";
import type { Pool } from "pg";

async function prepareTrust(db: Pool, identity: Identity) {
  await db.query(
    "UPDATE accounts SET display_name='Trading Family Trust',balance=1000 WHERE id=$1 AND user_id=$2",
    [identity.sixth, identity.userId]);
  await db.query(
    "INSERT INTO investments(account_id,symbol,shares,purchase_price,current_price) VALUES($1,'AAPL',10,200,200)",
    [identity.sixth]);
}

async function selectTrust(page: Page) {
  await page.goto("/investments");
  await page.getByRole("combobox").filter({ hasText: "Select Account" }).click();
  await page.getByRole("option", { name: "Trading Family Trust (CAD $1,000.00)", exact: true }).click();
}

async function financialRecords(db: Pool, userId: number) {
  const queries = [
    "SELECT * FROM accounts WHERE user_id=$1 ORDER BY id",
    "SELECT * FROM investments WHERE account_id IN (SELECT id FROM accounts WHERE user_id=$1) ORDER BY id",
    "SELECT * FROM transactions WHERE from_account_id IN (SELECT id FROM accounts WHERE user_id=$1) OR to_account_id IN (SELECT id FROM accounts WHERE user_id=$1) ORDER BY id",
    "SELECT * FROM fee_enrollments WHERE user_id=$1 ORDER BY id",
    "SELECT * FROM fee_assessments WHERE account_id IN (SELECT id FROM accounts WHERE user_id=$1) ORDER BY id",
    "SELECT display_currency FROM users WHERE id=$1",
    "SELECT * FROM payees WHERE user_id=$1 ORDER BY id",
    "SELECT name,debt_clearance_required,debt_payment_confirmed_at FROM users WHERE id=$1",
    "SELECT * FROM institutional_transfers WHERE user_id=$1 ORDER BY id",
  ];
  return Promise.all(queries.map(async sql => (await db.query(sql, [userId])).rows));
}

test.describe("trust pricing suspension", () => {
test.use({ expectedHttpFailures: {
  "/api/investments/buy": 503,
  "/api/investments/sell": 503,
} });

test("clients select trusts alongside retirement accounts but cannot trade without verified pricing", async ({ page, identity, db }, info) => {
  await prepareTrust(db, identity);
  await db.query(
    "INSERT INTO accounts(user_id,account_type,display_name,balance,is_demo) VALUES($1,'401(k) / 403(b)','Workplace Retirement',100,true)",
    [identity.userId]);
  const before = await financialRecords(db, identity.userId);
  await login(page, identity);
  await page.goto("/accounts");
  await expect(page.getByTestId("account-group-business").getByTestId(`account-row-${identity.sixth}`))
    .toContainText("Trading Family Trust");
  await expect(page.getByTestId("account-group-investment").getByTestId(`account-row-${identity.sixth}`)).toHaveCount(0);
  await page.goto("/investments");
  await page.getByRole("combobox").filter({ hasText: "Select Account" }).click();
  for (const name of ["Trading Family Trust", "Fee Reserve Trust", "Funded Brokerage", "Retirement Savings",
    "Additional Retirement", "Education Fund", "Workplace Retirement"]) {
    await expect(page.getByRole("option", { name: new RegExp(`^${name} \\(CAD`) })).toBeVisible();
  }
  await page.getByRole("option", { name: "Trading Family Trust (CAD $1,000.00)", exact: true }).click();
  await page.screenshot({ path: info.outputPath("trust-selected.png"), fullPage: true });
  await page.getByPlaceholder("0.00", { exact: true }).fill("100");
  await expect(page.getByRole("button", { name: "Buy Stock", exact: true })).toBeDisabled();
  await page.getByRole("tab", { name: "Sell", exact: true }).click();
  await page.getByPlaceholder("0", { exact: true }).fill("1");
  await expect(page.getByRole("button", { name: "Sell Shares", exact: true })).toBeDisabled();
  for (const operation of ["buy", "sell"]) {
    const response = await page.request.post(`/api/investments/${operation}`, { data: {
      accountId: identity.sixth, symbol: "AAPL", ...(operation === "buy" ? { amount: "100" } : { shares: "1" }),
    } });
    expect(response.status()).toBe(503);
    expect((await response.json()).code).toBe("MARKET_DATA_UNAVAILABLE");
  }
  expect(await financialRecords(db, identity.userId)).toEqual(before);
  await page.screenshot({ path: info.outputPath("trust-trading-paused.png"), fullPage: true });
});
});

test.describe("liquidation status verification failure", () => {
  test.use({ expectedHttpFailures: { "/api/institutional-transfers": 503 } });

  test("status query failures block every protected write without changing financial records, then recover", async ({ page, identity, db, failLiquidationQueries }, info) => {
    await prepareTrust(db, identity);
    await login(page, identity);
    await expect(page.getByTestId("liquidation-status-unavailable")).toHaveCount(0);
    const before = await financialRecords(db, identity.userId);

    await failLiquidationQueries(async () => {
      await page.goto("/transfers");
      await page.reload();
      const notice = page.getByTestId("liquidation-status-unavailable");
      await expect(notice).toContainText("We cannot check portfolio transfer status right now");
      await expect(page.getByText("No transfer requests yet", { exact: true })).toHaveCount(0);
      await expect(page.getByText("Portfolio transfer in progress", { exact: true })).toHaveCount(0);
      await expect(page.getByText("Transfers and investing are blocked until your account debt is cleared.", { exact: true })).toHaveCount(0);

      const writes = [
        { method: "POST", url: "/api/transactions/transfer", data: { fromAccountId: identity.funded, toAccountId: identity.extra, amount: "10" } },
        // This incoming request is already liquidation-protected; no new exception.
        { method: "POST", url: "/api/transactions/transfer", data: { fromAccountId: -1, toAccountId: identity.funded, amount: "10" } },
        { method: "POST", url: "/api/transactions/payment", data: { fromAccountId: identity.funded, payeeId: 1, amount: "10" } },
        { method: "POST", url: "/api/investments/buy", data: { accountId: identity.sixth, symbol: "AAPL", amount: "100" } },
        { method: "POST", url: "/api/investments/sell", data: { accountId: identity.sixth, symbol: "AAPL", shares: "1" } },
        { method: "POST", url: "/api/accounts", data: { accountType: "Trust Account", balance: "0" } },
        { method: "DELETE", url: `/api/accounts/${identity.extra}` },
        { method: "PATCH", url: "/api/user", data: { name: "Must Not Change" } },
        { method: "POST", url: "/api/payees", data: { name: "Must Not Create" } },
        { method: "DELETE", url: "/api/payees/1" },
        { method: "POST", url: "/api/institutional-transfers", data: {
          accountId: identity.sixth, institutionName: "Isolated Institution", institutionAccountNumber: "TEST-ONLY",
          accountType: "Trust Account", transferType: "cash", transferScope: "full",
        } },
      ];
      for (const write of writes) {
        const response = await page.request.fetch(write.url, write);
        expect(response.status(), `${write.method} ${write.url}`).toBe(503);
        expect(response.headers()["cache-control"]).toBe("no-store");
        const body = await response.json();
        expect(body.code).toBe("LIQUIDATION_STATUS_UNAVAILABLE");
        expect(body.message).toContain("Please try again");
      }
      // Marked actions explain the unavailable status without submitting a write.
      const requests: string[] = [];
      const record = (request: import("@playwright/test").Request) => {
        if (request.method() === "POST") requests.push(request.url());
      };
      page.on("request", record);
      await page.getByTestId("button-new-institutional-transfer").click();
      const dialog = page.getByTestId("funds-action-dialog");
      await expect(dialog).toContainText("Portfolio transfer status unavailable");
      await dialog.getByRole("button", { name: "Close", exact: true }).first().click();
      await expect(dialog).toHaveCount(0);
      page.off("request", record);
      expect(requests).toEqual([]);
      expect(await financialRecords(db, identity.userId)).toEqual(before);
      await page.screenshot({ path: info.outputPath("liquidation-status-unavailable.png"), fullPage: true });
    });

    const retry = page.getByRole("button", { name: "Retry status check" });
    if (await retry.isVisible()) await retry.click();
    await expect(page.getByTestId("liquidation-status-unavailable")).toHaveCount(0);
    await expect(page.getByText("No transfer requests yet", { exact: true })).toBeVisible();
    // Trading still respects the separate pricing restriction after recovery.
    const trade = await page.request.post("/api/investments/buy", { data: { accountId: identity.sixth, symbol: "AAPL", amount: "100" } });
    expect(trade.status()).toBe(503);
    expect((await trade.json()).code).toBe("MARKET_DATA_UNAVAILABLE");
    const transfer = await page.request.post("/api/transactions/transfer", { data: { fromAccountId: identity.funded, toAccountId: identity.extra, amount: "10" } });
    expect(transfer.status()).toBe(201);
    expect((await db.query("SELECT COUNT(*)::int AS n FROM transactions WHERE from_account_id=$1", [identity.funded])).rows[0].n).toBe(1);
    const institution = await page.request.post("/api/institutional-transfers", { data: {
      accountId: identity.sixth, institutionName: "Isolated Institution", institutionAccountNumber: "TEST-ONLY",
      accountType: "Trust Account", transferType: "cash", transferScope: "full",
    } });
    expect(institution.status()).toBe(200);
    expect((await institution.json()).status).toBe("pending");
    expect((await db.query("SELECT COUNT(*)::int AS n FROM institutional_transfers WHERE user_id=$1", [identity.userId])).rows[0].n).toBe(1);
  });

  test("a failed background refresh never treats cached liquidation status as current", async ({ page, identity, db, failLiquidationQueries }) => {
    await db.query(
      `INSERT INTO institutional_transfers(user_id,account_id,institution_name,institution_account_number,account_type,transfer_type,transfer_scope,status)
       VALUES($1,$2,'Isolated Institution','TEST-ONLY','Trust Account','cash','full','liquidating')`,
      [identity.userId, identity.sixth]);
    await login(page, identity);
    await expect(page.getByText("Portfolio transfer in progress", { exact: true })).toBeVisible();
    const before = await financialRecords(db, identity.userId);
    await failLiquidationQueries(async () => {
      await expect(page.getByTestId("liquidation-status-unavailable")).toContainText("We cannot check", { timeout: 25_000 });
      await expect(page.getByText("Portfolio transfer in progress", { exact: true })).toHaveCount(0);
      const response = await page.request.patch("/api/user", { data: { name: "Must Not Change" } });
      expect(response.status()).toBe(503);
      expect((await response.json()).code).toBe("LIQUIDATION_STATUS_UNAVAILABLE");
      expect(await financialRecords(db, identity.userId)).toEqual(before);
    });
    await page.getByRole("button", { name: "Retry status check" }).click();
    await expect(page.getByText("Portfolio transfer in progress", { exact: true })).toBeVisible();
    const stillLocked = await page.request.patch("/api/user", { data: { name: "Must Not Change" } });
    expect(stillLocked.status()).toBe(423);
    expect((await stillLocked.json()).message).toBe("LIQUIDATION_IN_PROGRESS");
    expect(await financialRecords(db, identity.userId)).toEqual(before);
  });
});

test.describe("trust trading restrictions", () => {
  test.use({ expectedHttpFailures: {
    "/api/investments/buy": 423,
    "/api/investments/sell": 423,
  } });

  test("debt-locked clients can select their trust but cannot buy or sell", async ({ page, identity, db }, info) => {
    await prepareTrust(db, identity);
    await db.query("UPDATE users SET debt_clearance_required=true,debt_payment_account_id=$2 WHERE id=$1",
      [identity.userId, identity.funded]);
    const before = await financialRecords(db, identity.userId);
    await login(page, identity);
    await selectTrust(page);
    await expect(page.getByRole("alert").filter({ hasText: "Transfers and investing are blocked until your account debt is cleared." })).toBeVisible();
    await assertFundsActionBlocked(page,page.getByRole("button", { name: "Buy Stock", exact: true }));
    await page.getByRole("tab", { name: "Sell", exact: true }).click();
    await assertFundsActionBlocked(page,page.getByRole("button", { name: "Sell Shares", exact: true }));
    for (const operation of ["buy", "sell"]) {
      const response = await page.request.post(`/api/investments/${operation}`, { data: {
        accountId: identity.sixth, symbol: "AAPL", ...(operation === "buy" ? { amount: "100" } : { shares: "1" }),
      } });
      expect(response.status()).toBe(423);
      expect((await response.json()).message).toBe("DEBT_PAYMENT_REQUIRED");
    }
    expect(await financialRecords(db, identity.userId)).toEqual(before);
    await page.screenshot({ path: info.outputPath("trust-debt-locked.png"), fullPage: true });
  });

  for (const status of ["liquidating", "approved", "transfer_out"]) {
    test(`trust buy and sell are rejected during ${status} liquidation`, async ({ page, identity, db }) => {
      await prepareTrust(db, identity);
      await db.query(
        `INSERT INTO institutional_transfers(user_id,account_id,institution_name,institution_account_number,account_type,transfer_type,transfer_scope,status)
         VALUES($1,$2,'Isolated Institution','TEST-ONLY','Trust Account','cash','full',$3)`,
        [identity.userId, identity.sixth, status]);
      const before = await financialRecords(db, identity.userId);
      await login(page, identity);
      await selectTrust(page);
      for (const operation of ["buy", "sell"]) {
        await page.getByRole("tab", { name: operation === "buy" ? "Buy" : "Sell", exact: true }).click();
        await page.getByPlaceholder(operation === "buy" ? "0.00" : "0", { exact: true }).fill(operation === "buy" ? "100" : "1");
        await expect(page.getByRole("button", { name: operation === "buy" ? "Buy Stock" : "Sell Shares", exact: true })).toBeDisabled();
        const response = await page.request.post(`/api/investments/${operation}`, { data: {
          accountId: identity.sixth, symbol: "AAPL", ...(operation === "buy" ? { amount: "100" } : { shares: "1" }),
        } });
        expect(response.status()).toBe(423);
        expect((await response.json()).message).toBe("LIQUIDATION_IN_PROGRESS");
      }
      expect(await financialRecords(db, identity.userId)).toEqual(before);
    });
  }
});

test.describe("trust ownership", () => {
  test.use({ expectedHttpFailures: {
    "/api/investments/buy": 403,
    "/api/investments/sell": 403,
  } });

  test("clients cannot select or trade another client's trust", async ({ page, identity, db }) => {
    // A second disposable owner, not an existing client or an authentication bypass.
    const { rows: [owner] } = await db.query(
      "INSERT INTO users(client_ref,email,name,password) SELECT $1,$2,'Other Isolated Owner',password FROM users WHERE id=$3 RETURNING id",
      [`${identity.ref}-OTHER`, `${identity.ref}-other@example.invalid`, identity.userId]);
    const { rows: [trust] } = await db.query(
      "INSERT INTO accounts(user_id,account_type,display_name,balance,is_demo) VALUES($1,'Trust Account','Other Owner Trust',1000,true) RETURNING id",
      [owner.id]);
    await db.query("INSERT INTO investments(account_id,symbol,shares,purchase_price,current_price) VALUES($1,'AAPL',10,200,200)", [trust.id]);
    const before = await financialRecords(db, owner.id);
    await login(page, identity);
    await page.goto("/investments");
    await page.getByRole("combobox").filter({ hasText: "Select Account" }).click();
    await expect(page.getByRole("option", { name: /Other Owner Trust/ })).toHaveCount(0);
    for (const operation of ["buy", "sell"]) {
      const response = await page.request.post(`/api/investments/${operation}`, { data: {
        accountId: trust.id, symbol: "AAPL", ...(operation === "buy" ? { amount: "100" } : { shares: "1" }),
      } });
      expect(response.status()).toBe(403);
      expect((await response.json()).message).toBe("Unauthorized account");
    }
    expect(await financialRecords(db, owner.id)).toEqual(before);
  });
});
