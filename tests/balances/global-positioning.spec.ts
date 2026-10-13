import { test, expect, login, verifyHeadline, assertFundsActionBlocked } from "./fixtures";

const prohibited = /\b(CDIC|CIPF|CIRO|FINTRAC|Deloitte)\b|Canadian clients|high net worth Canadians|registered Canadian/;

test("public positioning is global without Canadian institutional or audit claims", async ({ page }, info) => {
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect(page.locator("body")).toContainText("Global private offshore wealth management");
    await expect(page.locator("body")).not.toContainText(prohibited);
    await expect(page).toHaveTitle("Veritas Wealth - Global Private Offshore Wealth Management");
    await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /Global private offshore wealth management/);
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", /Global Private Offshore Wealth Management/);
    await page.screenshot({path: info.outputPath(`global-home-${width}.png`), animations: "disabled"});
    await page.goto("/auth");
    await expect(page.getByRole("button", {name:"Sign in to Veritas", exact:true})).toBeVisible();
    await expect(page.locator("body")).not.toContainText(prohibited);
    if (width === 1440) {
      await expect(page.getByText("Global Private Offshore Wealth Management", {exact:true})).toBeVisible();
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  }
});

test("global client wording preserves balances, currencies, contracts and transfer restrictions", async ({ page, identity, db }) => {
  await db.query("UPDATE users SET debt_clearance_required=true,debt_payment_account_id=$2 WHERE id=$1", [identity.userId, identity.debt]);
  const snapshot = async () => Promise.all([
    "SELECT * FROM accounts WHERE user_id=$1 ORDER BY id",
    "SELECT * FROM transactions WHERE from_account_id IN (SELECT id FROM accounts WHERE user_id=$1) OR to_account_id IN (SELECT id FROM accounts WHERE user_id=$1) ORDER BY id",
    "SELECT * FROM fee_enrollments WHERE user_id=$1 ORDER BY id",
    "SELECT * FROM management_contracts WHERE user_id=$1 ORDER BY id",
    "SELECT display_currency,debt_clearance_required,debt_payment_account_id,account_frozen,login_restricted FROM users WHERE id=$1",
  ].map(async sql => (await db.query(sql, [identity.userId])).rows));
  const before = await snapshot();
  await login(page, identity);
  await verifyHeadline(page);
  await expect(page.locator("body")).toContainText("Global private offshore wealth management");
  await expect(page.locator("body")).not.toContainText(prohibited);
  await assertFundsActionBlocked(page, "button-quick-transfer");
  await assertFundsActionBlocked(page, "button-quick-invest");
  await page.goto("/accounts");
  await expect(page.getByTestId("text-total-balance")).toHaveText("CAD $2,003,900.25");
  await expect(page.locator("body")).toContainText("Global private offshore wealth management");
  await expect(page.locator("body")).not.toContainText(prohibited);
  await page.goto("/transfers");
  await expect(page.getByText("Request a portfolio transfer to another financial institution.", {exact:true})).toBeVisible();
  await expect(page.locator("body")).not.toContainText(prohibited);
  await assertFundsActionBlocked(page, "button-new-institutional-transfer");
  expect(await snapshot()).toEqual(before);
});
