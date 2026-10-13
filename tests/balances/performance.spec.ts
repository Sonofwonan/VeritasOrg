import { test, expect, login, verifyHeadline, assertFundsActionBlocked } from "./fixtures";

test("unsupported performance is omitted without inventing returns or changing financial records", async ({ page, identity, db }) => {
  test.setTimeout(120000);
  await db.query(
    `INSERT INTO transactions(to_account_id,amount,description,transaction_type,status)
     VALUES($1,2000000.25,'Synthetic inheritance deposit','transfer','completed')`,
    [identity.funded],
  );
  // Shares, cost and a numeric current price are not verified quote evidence.
  const { rows: [holding] } = await db.query(
    "SELECT id FROM investments WHERE account_id=$1", [identity.funded],
  );
  const snapshot = async () => Promise.all([
    "SELECT * FROM accounts WHERE user_id=$1 ORDER BY id",
    "SELECT * FROM investments WHERE account_id IN (SELECT id FROM accounts WHERE user_id=$1) ORDER BY id",
    "SELECT * FROM transactions WHERE from_account_id IN (SELECT id FROM accounts WHERE user_id=$1) OR to_account_id IN (SELECT id FROM accounts WHERE user_id=$1) ORDER BY id",
    "SELECT * FROM fee_enrollments WHERE user_id=$1 ORDER BY id",
    "SELECT * FROM fee_assessments WHERE account_id IN (SELECT id FROM accounts WHERE user_id=$1) ORDER BY id",
    "SELECT debt_clearance_required,debt_payment_account_id,debt_payment_confirmed_at FROM users WHERE id=$1",
  ].map(async sql => (await db.query(sql, [identity.userId])).rows));
  const before = await snapshot();
  const noUnsupportedPerformance = async () => {
    await expect(page.getByTestId("text-performance-explanation")).toHaveCount(0);
    await expect(page.locator("main").last()).not.toContainText(/unavailable|YTD Return|investment gains|not investment returns/i);
    await expect(page.getByTestId("sidebar-toggle")).toHaveAttribute("aria-expanded", "false");
    await expect(page.getByTestId("top-navigation-toggle")).toHaveAttribute("aria-expanded", "false");
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth))
      .toBeLessThanOrEqual(page.viewportSize()!.width);
  };
  for (const currency of ["CAD", "GBP"]) {
    await db.query("UPDATE users SET display_currency=$1 WHERE id=$2", [currency, identity.userId]);
    await page.request.post("/api/logout");
    await login(page, identity);
    await verifyHeadline(page, currency === "GBP" ? "£2,003,900.25" : "$2,003,900.25");
    await noUnsupportedPerformance();
    for (const id of ["text-day-performance", "text-ytd-performance", `holding-pnl-${holding.id}`, "text-holdings-performance"]) {
      await expect(page.getByTestId(id)).toHaveCount(0);
    }
    await expect(page.getByTestId(`debt-account-amount-${identity.debt}`))
      .toHaveText(currency === "GBP" ? "-£1,614.39" : "CAD -$1,614.39");
    // Four supported fields: desktop columns and labeled mobile fields,
    // with no empty P&L header/cells.
    const cells = page.getByTestId(`holding-row-${holding.id}`).locator(":scope > *");
    await expect(cells).toHaveCount(4);
    const centers = await cells.evaluateAll(nodes => nodes.map(node=>{
      const rect = node.getBoundingClientRect();
      return rect.top + rect.height / 2;
    }));
    if (page.viewportSize()!.width >= 640) {
      expect(Math.max(...centers)-Math.min(...centers)).toBeLessThan(1);
    } else {
      const row = page.getByTestId(`holding-row-${holding.id}`);
      for (const label of ["Shares", "Avg Cost", "Stored Value"]) {
        await expect(row.getByText(label, {exact:true})).toBeVisible();
      }
      const bounds = await cells.evaluateAll(nodes => nodes.map(node => {
        const rect = node.getBoundingClientRect();
        return {left:rect.left,right:rect.right};
      }));
      for (const box of bounds) {
        expect(box.left).toBeGreaterThanOrEqual(0);
        expect(box.right).toBeLessThanOrEqual(page.viewportSize()!.width);
      }
    }
    await expect(page.getByText("P&L", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Synthetic inheritance deposit", { exact: true })).toBeVisible();
    await page.screenshot({path:test.info().outputPath(`dashboard-${currency}.png`),animations:"disabled"});
    if (currency === "GBP") {
      await expect(page.locator("main").last()).not.toContainText("CAD");
      await expect(page.locator("main").last()).not.toContainText("GBP");
    }
    await page.goto("/accounts");
    await expect(page.getByTestId("text-total-balance")).toHaveText(currency === "GBP" ? "£2,003,900.25" : "CAD $2,003,900.25");
    await noUnsupportedPerformance();
    await expect(page.getByTestId("text-ytd-performance")).toHaveCount(0);
    for (const id of [identity.funded, identity.debt, identity.sixth]) {
      await expect(page.getByTestId(`account-ytd-${id}`)).toHaveCount(0);
    }
    await page.screenshot({path:test.info().outputPath(`accounts-${currency}.png`),animations:"disabled"});
    await page.getByTestId("button-toggle-balances").click();
    await expect(page.getByTestId("text-total-balance")).toContainText("•");
    await expect(page.getByTestId(`account-ytd-${identity.funded}`)).toHaveCount(0);
    await page.goto("/investments");
    await expect(page.getByText("Current Holdings",{exact:true})).toBeVisible();
    await expect(page.getByText("TEST", { exact: true })).toBeVisible();
    await noUnsupportedPerformance();
    await expect(page.getByTestId(`investment-gain-${holding.id}`)).toHaveCount(0);
    await page.screenshot({path:test.info().outputPath(`investments-${currency}.png`),animations:"disabled"});
    await page.getByRole("tab", {name: "Cash", exact: true}).click();
    await expect(page.getByText("Your Cash Positions",{exact:true})).toBeVisible();
    await noUnsupportedPerformance();
    for (const id of ["text-cash-sweep-apy","text-money-market-yield",`cash-apy-${identity.funded}`,`cash-interest-${identity.funded}`]) {
      await expect(page.getByTestId(id)).toHaveCount(0);
    }
    await expect(page.getByRole("columnheader")).toHaveText(["Account","Cash Balance"]);
    await expect(page.getByRole("button", {name:"Enable Cash Sweep",exact:true})).toHaveCount(0);
    await page.screenshot({path:test.info().outputPath(`cash-positions-${currency}.png`),fullPage:true});
  }
  expect(await snapshot()).toEqual(before);
});

test("hiding unsupported performance retains blocked-action feedback and access restrictions", async ({page,identity,db}) => {
  await db.query("UPDATE users SET display_currency='GBP',debt_clearance_required=true,debt_payment_account_id=$2 WHERE id=$1",
    [identity.userId,identity.debt]);
  await login(page,identity);
  await verifyHeadline(page,"£2,003,900.25");
  await assertFundsActionBlocked(page,"button-quick-transfer");
  await assertFundsActionBlocked(page,"button-quick-invest");
  await expect(page.getByTestId("debt-restriction-unavailable")).toHaveCount(0);
  await expect(page.getByTestId("text-performance-explanation")).toHaveCount(0);
  await expect(page.getByTestId("text-day-performance")).toHaveCount(0);
  await expect(page.getByTestId("text-ytd-performance")).toHaveCount(0);
  await page.goto("/investments");
  await assertFundsActionBlocked(page,page.getByRole("button",{name:"Buy Stock",exact:true}));
  await expect(page.getByRole("heading",{name:"Investments",exact:true})).toBeVisible();
  await page.screenshot({path:test.info().outputPath("restricted-investments.png"),animations:"disabled"});
});
