import { test, expect, login, type Identity } from "./fixtures";
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
    await expect(page.getByRole("alert").filter({ hasText: "Payment must be recorded" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Buy Stock", exact: true })).toBeDisabled();
    await page.getByRole("tab", { name: "Sell", exact: true }).click();
    await expect(page.getByRole("button", { name: "Sell Shares", exact: true })).toBeDisabled();
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
