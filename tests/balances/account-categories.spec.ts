import { test, expect, login, verifyHeadline } from "./fixtures";
import type { Pool } from "pg";
import { assertFundsActionBlocked } from "./fixtures";

async function financialRecords(db: Pool, userId: number) {
  const queries = [
    "SELECT * FROM accounts WHERE user_id=$1 ORDER BY id",
    "SELECT * FROM transactions WHERE from_account_id IN (SELECT id FROM accounts WHERE user_id=$1) OR to_account_id IN (SELECT id FROM accounts WHERE user_id=$1) ORDER BY id",
    "SELECT * FROM investments WHERE account_id IN (SELECT id FROM accounts WHERE user_id=$1) ORDER BY id",
    "SELECT * FROM fee_enrollments WHERE user_id=$1 ORDER BY id",
    "SELECT * FROM fee_assessments WHERE account_id IN (SELECT id FROM accounts WHERE user_id=$1) ORDER BY id",
    "SELECT display_currency,debt_clearance_required,debt_payment_account_id,debt_payment_confirmed_at FROM users WHERE id=$1",
  ];
  return Promise.all(queries.map(async sql => (await db.query(sql, [userId])).rows));
}

test("named funded trusts and brokerage stay in their presentation groups without changing financial records", async ({ page, identity, db }, info) => {
  // Only this disposable identity in the runner-owned local cluster is changed.
  await db.query("UPDATE accounts SET display_name='Funded Family Trust' WHERE id=$1 AND user_id=$2",
    [identity.sixth, identity.userId]);
  await db.query(
    "INSERT INTO accounts(user_id,account_type,display_name,balance,is_demo) VALUES($1,'401(k) / 403(b)','Workplace Retirement',100,true)",
    [identity.userId]);
  const before = await financialRecords(db, identity.userId);
  const { rows: accounts } = await db.query(
    "SELECT id,account_type,display_name,balance FROM accounts WHERE user_id=$1 ORDER BY id",
    [identity.userId]);
  const money = (n: number) => new Intl.NumberFormat("en-CA", {
    style: "currency", currency: "CAD", currencyDisplay: "narrowSymbol",
  }).format(n);
  const investmentTotal = accounts.filter(a => a.account_type !== "Trust Account")
    .reduce((sum, a) => sum + Math.max(0, Number(a.balance)), 0);
  const trustTotal = accounts.filter(a => a.account_type === "Trust Account")
    .reduce((sum, a) => sum + Math.max(0, Number(a.balance)), 0);
  const signedTrustTotal = accounts.filter(a => a.account_type === "Trust Account")
    .reduce((sum, a) => sum + Number(a.balance), 0);
  const cashTotal = investmentTotal + trustTotal;
  const holdingsTotal = before[2].reduce((sum, holding) => sum + Number(holding.shares) * Number(holding.current_price ?? holding.purchase_price), 0);

  await login(page, identity);
  // Positive cash and holdings, not net of the trust's overdraft.
  await verifyHeadline(page, "$2,004,000.25");
  await expect(page.getByTestId(`debt-account-name-${identity.debt}`)).toHaveText("Fee Reserve Trust");
  await expect(page.getByTestId(`debt-account-details-${identity.debt}`)).toHaveCount(0);
  await expect(page.getByTestId(`dash-account-${identity.debt}`)).toContainText("CAD -$1,250.75");
  await page.goto("/accounts");
  await expect(page.getByTestId("text-total-balance")).toHaveText(`CAD ${money(cashTotal + holdingsTotal)}`);
  for (const [cat, total] of [["cash", cashTotal], ["investment", holdingsTotal]] as const) {
    await expect(page.getByTestId(`account-summary-balance-${cat}`)).toHaveText(`CAD ${money(total)}`);
  }
  await expect(page.locator('[data-testid^="account-group-balance-"]')).toHaveCount(0);
  await expect(page.getByTestId("account-summary-investment")).toContainText("Recorded investments");
  const investmentGroup = page.getByTestId("account-group-investment");
  const trustGroup = page.getByTestId("account-group-business");
  await expect(investmentGroup).toContainText("Brokerage & Retirement");
  await expect(trustGroup).toContainText("Business & Trust");
  await expect(investmentGroup.locator('[data-testid^="account-row-"]')).toHaveCount(5);
  await expect(trustGroup.locator('[data-testid^="account-row-"]')).toHaveCount(2);
  for (const account of accounts) {
    const group = account.account_type === "Trust Account" ? trustGroup : investmentGroup;
    const other = account.account_type === "Trust Account" ? investmentGroup : trustGroup;
    const row = group.getByTestId(`account-row-${account.id}`);
    const ledgerBalance = Number(account.balance);
    await expect(row).toContainText(account.display_name);
    // Liabilities remain signed in storage, but never reduce funded summaries.
    await expect(row.getByTestId(`balance-${account.id}`)).toHaveText(`CAD ${money(ledgerBalance)}`);
    if (ledgerBalance < 0) {
      await expect(row.getByText("Balance", { exact: true })).toHaveCount(0);
    }
    await expect(other.getByTestId(`account-row-${account.id}`)).toHaveCount(0);
  }
  await page.screenshot({ path: info.outputPath("named-account-categories.png"), fullPage: true });
  await page.getByTestId("button-toggle-balances").click();
  for (const cat of ["cash", "investment"]) {
    await expect(page.getByTestId(`account-summary-balance-${cat}`)).toHaveText("••••••");
  }
  await expect(page.locator('[data-testid^="account-group-balance-"]')).toHaveCount(0);
  await page.getByTestId("button-toggle-balances").click();
  await trustGroup.getByTestId(`account-row-${identity.sixth}`).click();
  await expect(page).toHaveURL(new RegExp(`/accounts/${identity.sixth}$`));
  await expect(page.getByRole("heading", { name: "Funded Family Trust", exact: true })).toBeVisible();
  await page.goto("/accounts");
  await page.getByTestId("button-open-account").click();
  await page.getByRole("dialog").getByRole("combobox").click();
  const trustOption = page.getByRole("option", { name: "Trust Account", exact: true });
  await expect(trustOption.locator("..")).toContainText("Business & Trust");
  await expect(trustOption.locator("..")).not.toContainText("Brokerage Account");
  await expect(page.getByRole("option")).toHaveCount(6);
  expect(await financialRecords(db, identity.userId)).toEqual(before);
});

test("inheritance cash and Brokerage overdraft stay separate, including during transfer and query failures", async ({ page, identity, db }, info) => {
  test.setTimeout(120000);
  await db.query("UPDATE accounts SET balance=0 WHERE user_id=$1", [identity.userId]);
  await db.query("UPDATE accounts SET balance=-12398.48,display_name='Brokerage Account' WHERE id=$1 AND user_id=$2", [identity.funded, identity.userId]);
  await db.query("UPDATE accounts SET balance=1622886,display_name='Inheritance Trust Account' WHERE id=$1 AND user_id=$2", [identity.sixth, identity.userId]);
  await db.query("DELETE FROM investments WHERE account_id IN (SELECT id FROM accounts WHERE user_id=$1)", [identity.userId]);
  await db.query("DELETE FROM fee_assessments WHERE account_id IN (SELECT id FROM accounts WHERE user_id=$1)", [identity.userId]);
  await db.query("UPDATE users SET display_currency='GBP',debt_clearance_required=true,debt_payment_account_id=$2 WHERE id=$1", [identity.userId, identity.funded]);
  const before = await financialRecords(db, identity.userId);
  await login(page, identity);
  await verifyHeadline(page, "£1,622,886.00");
  await assertFundsActionBlocked(page, "button-quick-transfer");
  await page.goto("/accounts");
  await expect(page.getByTestId("text-total-balance")).toHaveText("£1,622,886.00");
  await expect(page.getByTestId("account-summary-balance-cash")).toHaveText("£1,622,886.00");
  await expect(page.getByTestId("account-summary-balance-investment")).toHaveText("£0.00");
  await expect(page.locator('[data-testid^="account-group-balance-"]')).toHaveCount(0);
  await expect(page.getByTestId(`debt-account-amount-${identity.funded}`)).toHaveText("£12,398.48");
  await expect(page.getByTestId("debt-account-summary")).not.toContainText("Inheritance Trust Account");
  await expect(page.getByTestId(`account-row-${identity.funded}`)).toContainText("-£12,398.48");
  await expect(page.locator("main.overflow-y-auto")).not.toContainText(/£1,610,487.52|Net Account Balance · After Unpaid Fees|\bCAD\b|\bGBP\b/);
  for (const width of [320, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect(page.getByTestId("text-total-balance")).toHaveText("£1,622,886.00");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath(`funded-and-overdraft-${width}.png`), animations: "disabled" });
  }
  await page.getByTestId("sidebar-toggle").click();
  await expect(page.locator("#veritas-side-navigation")).toBeVisible();
  await expect(page.getByTestId("text-total-balance")).toHaveText("£1,622,886.00");
  await page.screenshot({ path: info.outputPath("funded-and-overdraft-sidebar.png"), animations: "disabled" });
  await page.getByTestId("sidebar-toggle").click();
  await page.getByTestId("button-toggle-balances").click();
  for (const id of ["text-total-balance", "account-summary-balance-cash", "account-summary-balance-investment", `debt-account-amount-${identity.funded}`]) {
    await expect(page.getByTestId(id)).toHaveText("••••••");
  }
  await page.getByTestId("button-toggle-balances").click();
  await page.route("**/api/institutional-transfers", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([{id:999,status:"transfer_out",institutionName:"Synthetic Receiving Institution",transferType:"cash"}]) }));
  await page.reload();
  await expect(page.getByTestId("text-total-balance")).toHaveText("£1,622,886.00");
  await expect(page.getByTestId(`balance-${identity.sixth}`)).toHaveText("£1,622,886.00");
  await expect(page.getByTestId(`debt-account-amount-${identity.funded}`)).toHaveText("£12,398.48");
  await page.unroute("**/api/institutional-transfers");
  await page.route("**/api/investments", route => route.fulfill({status:503,contentType:"application/json",body:'{"message":"Synthetic price-history failure"}'}));
  await page.reload();
  await expect(page.getByTestId("text-total-balance")).toHaveText("Unavailable");
  await expect(page.getByTestId("account-summary-balance-cash")).toHaveText("£1,622,886.00");
  await expect(page.getByTestId("account-summary-balance-investment")).toHaveText("Unavailable");
  await expect(page.getByTestId(`debt-account-amount-${identity.funded}`)).toHaveText("£12,398.48");
  await page.unroute("**/api/investments");
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(page.getByTestId("text-total-balance")).toHaveText("£1,622,886.00");
  expect(await financialRecords(db, identity.userId)).toEqual(before);
});

test.use({ expectedHttpFailures: { "/api/investments": 503 } });
