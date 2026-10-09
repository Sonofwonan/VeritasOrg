import { test, expect, login, verifyHeadline } from "./fixtures";

test("unverified holdings, inheritance deposits and fee overdrafts never imply returns", async ({ page, identity, db }) => {
  await db.query(
    `INSERT INTO transactions(to_account_id,amount,description,transaction_type,status)
     VALUES($1,2000000.25,'Synthetic inheritance deposit','transfer','completed')`,
    [identity.funded],
  );
  // Shares, cost and a numeric current price are not verified quote evidence.
  const { rows: [holding] } = await db.query(
    "SELECT id FROM investments WHERE account_id=$1", [identity.funded],
  );
  for (const currency of ["CAD", "GBP"]) {
    await db.query("UPDATE users SET display_currency=$1 WHERE id=$2", [currency, identity.userId]);
    await page.request.post("/api/logout");
    await login(page, identity);
    await verifyHeadline(page, currency === "GBP" ? "£2,003,900.25" : "$2,003,900.25");
    await expect(page.getByTestId("text-day-performance")).toHaveText("Daily change unavailable");
    await expect(page.getByTestId("text-ytd-performance")).toHaveText("Unavailable");
    await expect(page.getByTestId(`holding-pnl-${holding.id}`)).toHaveText("Unavailable");
    await expect(page.getByTestId("text-holdings-performance")).toHaveText("Unavailable");
    // Exactly five cells for the five headers, with P&L on the same grid row.
    const cells = page.getByTestId(`holding-row-${holding.id}`).locator(":scope > *");
    await expect(cells).toHaveCount(5);
    const centers = await cells.evaluateAll(nodes => nodes.map(node=>{
      const rect = node.getBoundingClientRect();
      return rect.top + rect.height / 2;
    }));
    expect(Math.max(...centers)-Math.min(...centers)).toBeLessThan(1);
    await expect(page.getByTestId("text-performance-explanation")).toContainText("Deposits are not investment gains");
    await expect(page.getByTestId("text-performance-explanation")).toContainText("fee overdrafts are account liabilities");
    await expect(page.getByText("Synthetic inheritance deposit", { exact: true })).toBeVisible();
    if (currency === "GBP") {
      await expect(page.locator("main").last()).not.toContainText("CAD");
      await expect(page.locator("main").last()).not.toContainText("GBP");
    }
    await page.goto("/accounts");
    await expect(page.getByTestId("text-ytd-performance")).toHaveText("YTD return unavailable");
    for (const id of [identity.funded, identity.debt, identity.sixth]) {
      await expect(page.getByTestId(`account-ytd-${id}`)).toHaveText("Unavailable");
    }
    await page.getByTestId("button-toggle-balances").click();
    await expect(page.getByTestId("text-total-balance")).toContainText("•");
    await expect(page.getByTestId(`account-ytd-${identity.funded}`)).toHaveText("Unavailable");
    await page.goto("/investments");
    await expect(page.getByTestId(`investment-gain-${holding.id}`)).toHaveText("Gain unavailable");
    await page.getByRole("tab", {name: "Cash", exact: true}).click();
    await expect(page.getByTestId("text-cash-sweep-apy")).toHaveText("Unavailable");
    await expect(page.getByTestId("text-money-market-yield")).toHaveText("Unavailable");
    await expect(page.getByTestId(`cash-apy-${identity.funded}`)).toHaveText("Unavailable");
    await expect(page.getByTestId(`cash-interest-${identity.funded}`)).toHaveText("Unavailable");
    await page.screenshot({path:test.info().outputPath(`unavailable-cash-interest-${currency}.png`),fullPage:true});
  }
});
