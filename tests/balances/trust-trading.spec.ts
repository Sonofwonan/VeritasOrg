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

test("clients select trusts alongside retirement accounts and buy and sell through normal trading controls", async ({ page, identity, db }, info) => {
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
  const buyResponse = page.waitForResponse(r => new URL(r.url()).pathname === "/api/investments/buy" && r.request().method() === "POST");
  await page.getByRole("button", { name: "Buy Stock", exact: true }).click();
  const buy = await buyResponse;
  expect(buy.status()).toBe(201);
  expect(buy.request().postDataJSON()).toEqual({ accountId: identity.sixth, symbol: "AAPL", amount: "100" });
  const bought = await buy.json();
  expect(bought.accountId).toBe(identity.sixth);
  expect(Number(bought.shares)).toBeGreaterThan(10);
  await expect(page.getByText("Purchase Successful", { exact: true })).toBeVisible();
  const { rows: [cashAfterBuy] } = await db.query("SELECT balance FROM accounts WHERE id=$1", [identity.sixth]);
  expect(Number(cashAfterBuy.balance)).toBe(900);
  await page.getByRole("tab", { name: "Sell", exact: true }).click();
  await page.getByPlaceholder("0", { exact: true }).fill("1");
  const sellResponse = page.waitForResponse(r => new URL(r.url()).pathname === "/api/investments/sell" && r.request().method() === "POST");
  await page.getByRole("button", { name: "Sell Shares", exact: true }).click();
  const sell = await sellResponse;
  expect(sell.status()).toBe(201);
  expect(sell.request().postDataJSON()).toEqual({ accountId: identity.sixth, symbol: "AAPL", shares: "1" });
  const sold = await sell.json();
  expect(Number(sold.shares)).toBeCloseTo(Number(bought.shares) - 1, 4);
  await expect(page.getByText("Sale Successful", { exact: true })).toBeVisible();
  const { rows: trades } = await db.query(
    "SELECT from_account_id,to_account_id,amount,transaction_type,status FROM transactions WHERE from_account_id=$1 OR to_account_id=$1 ORDER BY id",
    [identity.sixth]);
  expect(trades).toHaveLength(2);
  expect(trades[0]).toMatchObject({ from_account_id: identity.sixth, to_account_id: null, transaction_type: "buy", status: "completed" });
  expect(Number(trades[0].amount)).toBe(100);
  expect(trades[1]).toMatchObject({ from_account_id: null, to_account_id: identity.sixth, transaction_type: "sell", status: "completed" });
  expect(Number(trades[1].amount)).toBeGreaterThan(0);
  const after = await financialRecords(db, identity.userId);
  expect(Number(after[0].find(a => a.id === identity.sixth).balance)).toBeCloseTo(900 + Number(trades[1].amount), 2);
  expect(after[1].find(i => i.account_id === identity.sixth).shares).toBe(sold.shares);
  expect(after[0].filter(a => a.id !== identity.sixth)).toEqual(before[0].filter(a => a.id !== identity.sixth));
  expect(after[1].filter(i => i.account_id !== identity.sixth)).toEqual(before[1].filter(i => i.account_id !== identity.sixth));
  expect(after.slice(3)).toEqual(before.slice(3)); // Fee history and currency preferences stay unchanged.
  await page.screenshot({ path: info.outputPath("trust-traded.png"), fullPage: true });
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
        const pending = page.waitForResponse(r => new URL(r.url()).pathname === `/api/investments/${operation}` && r.request().method() === "POST");
        await page.getByRole("button", { name: operation === "buy" ? "Buy Stock" : "Sell Shares", exact: true }).click();
        const response = await pending;
        expect(response.status()).toBe(423);
        expect((await response.json()).message).toBe("LIQUIDATION_IN_PROGRESS");
        await expect(page.getByText("423: LIQUIDATION_IN_PROGRESS", { exact: true }).first()).toBeVisible();
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
