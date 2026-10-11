import { test, expect, login, verifyHeadline, assertFundsActionBlocked } from "./fixtures";
import { assertReadable } from "./contrast-helper";

test.use({ expectedHttpFailures: { "/api/transactions": 503 } });

test("transaction history navigation, filters and pages show real owned records without changing money", async ({ page, identity, db }, info) => {
  test.setTimeout(120000);
  await db.query("UPDATE users SET display_currency='GBP',debt_clearance_required=true,debt_payment_account_id=$2 WHERE id=$1", [identity.userId, identity.debt]);
  for (let day = 1; day <= 25; day++) {
    await db.query("INSERT INTO transactions(from_account_id,amount,description,transaction_type,status,is_demo,created_at) VALUES($1,363.64,$2,'fee','completed',true,$3)",
      [identity.debt, `CAD monthly service fee · 2024-01-${String(day).padStart(2, "0")} · Assessment ${day} · Authorized fee overdraft`, `2024-01-${String(day).padStart(2, "0")}T15:00:00Z`]);
  }
  const deposit = (await db.query("INSERT INTO transactions(to_account_id,amount,description,transaction_type,status,is_demo,created_at) VALUES($1,1622886,'Synthetic inheritance deposit','transfer','completed',true,'2024-02-01T15:00:00Z') RETURNING id",
    [identity.funded])).rows[0].id;
  const internal = (await db.query("INSERT INTO transactions(from_account_id,to_account_id,amount,description,transaction_type,status,is_demo,created_at) VALUES($1,$2,432.10,'Synthetic transfer between accounts','transfer','completed',true,'2024-02-02T15:00:00Z') RETURNING id",
    [identity.funded, identity.debt])).rows[0].id;
  const refund = (await db.query("INSERT INTO transactions(to_account_id,amount,description,transaction_type,status,is_demo,created_at) VALUES($1,12.34,'Synthetic fee refund','fee_refund','completed',true,'2024-02-03T15:00:00Z') RETURNING id",
    [identity.debt])).rows[0].id;
  const snapshot = async () => Promise.all([
    "SELECT * FROM accounts WHERE user_id=$1 ORDER BY id",
    "SELECT * FROM fee_enrollments WHERE user_id=$1 ORDER BY id",
    "SELECT * FROM fee_assessments WHERE account_id IN (SELECT id FROM accounts WHERE user_id=$1) ORDER BY id",
    "SELECT * FROM transactions WHERE from_account_id IN (SELECT id FROM accounts WHERE user_id=$1) OR to_account_id IN (SELECT id FROM accounts WHERE user_id=$1) ORDER BY id",
    "SELECT display_currency,debt_clearance_required,debt_payment_account_id,debt_payment_confirmed_at FROM users WHERE id=$1",
  ].map(async sql => (await db.query(sql, [identity.userId])).rows));
  const before = await snapshot();
  await login(page, identity);
  await verifyHeadline(page, "£2,003,900.25");
  await assertFundsActionBlocked(page, "button-quick-transfer");
  await expect(page.getByTestId("funds-action-dialog")).toHaveCount(0);
  await page.getByTestId("button-quick-invest").click();
  await expect(page.getByTestId("funds-action-dialog")).toContainText("Please contact your advisor");
  await expect(page.getByRole("link", { name: "Contact advisor", exact: true })).toHaveAttribute("href", "mailto:veritaswealth@accountant.com");
  await page.keyboard.press("Escape");
  await page.getByTestId("view-transaction-history").click();
  await expect(page).toHaveURL(/\/transactions$/);
  await expect(page.getByRole("heading", { name: "Transaction history", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Portfolio Transfers" })).toHaveCount(0);
  await expect(page.getByTestId("transactions-page")).not.toContainText(/Full Ledger|Assessment \d|Authorized fee overdraft|\bCAD\b|\bGBP\b/);
  // The API is owner-scoped; history must expose every returned record through its pages.
  const records = await (await page.request.get("/api/transactions")).json();
  expect(records.every((row: any) => before[0].some((account: any) => account.id === row.fromAccountId || account.id === row.toAccountId))).toBe(true);
  await expect(page.getByTestId("transactions-pagination-summary")).toContainText(`of ${records.length}`);
  await expect(page.locator('[data-testid^="transaction-row-"]')).toHaveCount(20);
  await page.getByTestId("transactions-next-page").click();
  await expect(page.getByTestId("transactions-pagination-summary")).toContainText("Showing 21");
  await page.getByTestId("transactions-search").fill("inheritance");
  await expect(page.getByTestId(`transaction-row-${deposit}`)).toContainText("+£1,622,886.00");
  await expect(page.getByTestId(`transaction-row-${deposit}`)).toContainText("February 1, 2024");
  await page.getByTestId("transactions-search").fill("refund");
  await expect(page.getByTestId(`transaction-row-${refund}`)).toContainText("+£12.34");
  await page.getByTestId("transactions-search").fill("between accounts");
  await expect(page.getByTestId(`transaction-row-${internal}`)).toContainText("↔ £432.10");
  await page.getByTestId("transactions-account-filter").selectOption(String(identity.funded));
  await expect(page.getByTestId(`transaction-row-${internal}`)).toContainText("−£432.10");
  await page.getByTestId("transactions-account-filter").selectOption(String(identity.debt));
  await expect(page.getByTestId(`transaction-row-${internal}`)).toContainText("+£432.10");
  await page.getByTestId("transactions-search").fill("does-not-exist");
  await expect(page.getByTestId("transactions-no-results")).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await assertReadable(page, '[data-testid="transactions-page"]', info, `history-${width}`);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath(`history-${width}.png`), animations: "disabled" });
  }
  expect(await snapshot()).toEqual(before);
});

test("history failures are retryable and successful empty history is not a fetch failure", async ({ page, identity }, info) => {
  await page.route("**/api/transactions", route => route.fulfill({ status: 503, contentType: "application/json", body: '{"message":"Synthetic failed history"}' }));
  await login(page, identity);
  await page.goto("/transactions");
  await expect(page.getByTestId("transactions-error")).toBeVisible();
  await expect(page.getByTestId("transactions-empty")).toHaveCount(0);
  await page.unroute("**/api/transactions");
  await page.getByTestId("transactions-retry").click();
  await expect(page.getByTestId("transactions-error")).toHaveCount(0);
  await expect(page.locator('[data-testid^="transaction-row-"]')).not.toHaveCount(0);
  await page.route("**/api/transactions", route => route.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await page.reload();
  await expect(page.getByTestId("transactions-empty")).toBeVisible();
  await expect(page.getByTestId("transactions-error")).toHaveCount(0);
  await expect(page.getByTestId("transactions-pagination")).toHaveCount(0);
});

