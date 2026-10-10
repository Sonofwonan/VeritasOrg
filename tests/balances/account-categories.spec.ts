import { test, expect, login, verifyHeadline } from "./fixtures";
import type { Pool } from "pg";

async function financialRecords(db: Pool, userId: number) {
  const queries = [
    "SELECT * FROM accounts WHERE user_id=$1 ORDER BY id",
    "SELECT * FROM transactions WHERE from_account_id IN (SELECT id FROM accounts WHERE user_id=$1) OR to_account_id IN (SELECT id FROM accounts WHERE user_id=$1) ORDER BY id",
    "SELECT * FROM investments WHERE account_id IN (SELECT id FROM accounts WHERE user_id=$1) ORDER BY id",
    "SELECT * FROM fee_enrollments WHERE user_id=$1 ORDER BY id",
    "SELECT * FROM fee_assessments WHERE account_id IN (SELECT id FROM accounts WHERE user_id=$1) ORDER BY id",
    "SELECT display_currency FROM users WHERE id=$1",
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
    .reduce((sum, a) => sum + Number(a.balance), 0);
  const trustTotal = accounts.filter(a => a.account_type === "Trust Account")
    .reduce((sum, a) => sum + Number(a.balance), 0);
  const ledgerTotal = accounts.reduce((sum, a) => sum + Number(a.balance), 0);

  await login(page, identity);
  // Positive cash and holdings, not net of the trust's overdraft.
  await verifyHeadline(page, "$2,004,000.25");
  await expect(page.getByRole("link", { name: /Fee Reserve Trust: overdraft/ })).toBeVisible();
  await expect(page.getByTestId("text-fee-overdraft")).toContainText("$1,250.75");
  await page.goto("/accounts");
  await expect(page.getByTestId("text-total-balance")).toHaveText(`CAD ${money(ledgerTotal - 363.64)}`);
  for (const [cat, total] of [["cash", 0], ["investment", investmentTotal], ["business", trustTotal]] as const) {
    await expect(page.getByTestId(`account-summary-balance-${cat}`)).toHaveText(`CAD ${money(total)}`);
    if (cat !== "cash") {
      await expect(page.getByTestId(`account-group-balance-${cat}`)).toHaveText(`CAD ${money(total)}`);
    }
  }
  expect(investmentTotal + trustTotal).toBe(ledgerTotal);
  const investmentGroup = page.getByTestId("account-group-investment");
  const trustGroup = page.getByTestId("account-group-business");
  await expect(investmentGroup).toContainText("Investment & Retirement");
  await expect(trustGroup).toContainText("Business & Trust");
  await expect(investmentGroup.locator('[data-testid^="account-row-"]')).toHaveCount(5);
  await expect(trustGroup.locator('[data-testid^="account-row-"]')).toHaveCount(2);
  for (const account of accounts) {
    const group = account.account_type === "Trust Account" ? trustGroup : investmentGroup;
    const other = account.account_type === "Trust Account" ? investmentGroup : trustGroup;
    await expect(group.getByTestId(`account-row-${account.id}`)).toContainText(account.display_name);
    await expect(group.getByTestId(`balance-${account.id}`)).toHaveText(`CAD ${money(Number(account.balance))}`);
    await expect(other.getByTestId(`account-row-${account.id}`)).toHaveCount(0);
  }
  await page.screenshot({ path: info.outputPath("named-account-categories.png"), fullPage: true });
  await page.getByTestId("button-toggle-balances").click();
  for (const cat of ["cash", "investment", "business"]) {
    await expect(page.getByTestId(`account-summary-balance-${cat}`)).toHaveText("••••••");
  }
  for (const cat of ["investment", "business"]) {
    await expect(page.getByTestId(`account-group-balance-${cat}`)).toHaveText("••••••");
  }
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
