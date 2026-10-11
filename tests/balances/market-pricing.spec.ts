import { test, expect, login, verifyHeadline } from "./fixtures";
import { MARKET_UNAVAILABLE } from "../../shared/market";

test.use({ expectedHttpFailures: {
  "/api/investments/buy": 503,
  "/api/investments/sell": 503,
} });

test("public homepage omits simulated market ticker prices and changes", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Capital, protected. Wealth, grown.", exact: true })).toBeVisible();
  await expect(page.locator(".ticker-track")).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText(
    /22,456\.32|5,842\.16|18,429\.30|0\.7312|2,341\.40|78\.20|3\.64%|2\.84|67,420|\+0\.67%|\+0\.84%|\+1\.21%|-0\.18%|-0\.12%|\+0\.56%|-0\.03|\+1\.42%|\+2\.14%/,
  );
  await expect(page.getByText(/Live market ticker|Market data unavailable/i)).toHaveCount(0);
});

test("no provider means no quotes or execution, regardless of supplied source, freshness or currency", async ({ page, identity, db }) => {
  const snapshot = async () => Promise.all([
    "SELECT * FROM accounts WHERE user_id=$1 ORDER BY id",
    "SELECT * FROM investments WHERE account_id IN (SELECT id FROM accounts WHERE user_id=$1) ORDER BY id",
    "SELECT * FROM transactions WHERE from_account_id IN (SELECT id FROM accounts WHERE user_id=$1) OR to_account_id IN (SELECT id FROM accounts WHERE user_id=$1) ORDER BY id",
    "SELECT * FROM fee_enrollments WHERE user_id=$1 ORDER BY id",
    "SELECT * FROM fee_assessments WHERE account_id IN (SELECT id FROM accounts WHERE user_id=$1) ORDER BY id",
    "SELECT * FROM fee_audit WHERE enrollment_id IN (SELECT id FROM fee_enrollments WHERE user_id=$1) ORDER BY id",
    "SELECT display_currency,debt_clearance_required,debt_payment_account_id,debt_payment_confirmed_at FROM users WHERE id=$1",
  ].map(async sql => (await db.query(sql, [identity.userId])).rows));

  // The symbol has a stored numeric price; it must never become market evidence.
  await db.query(
    "INSERT INTO investments(account_id,symbol,shares,purchase_price,current_price) VALUES($1,'AAPL',10,200,250)",
    [identity.funded]);
  const anonymousQuote = await page.request.get("/api/market/quote/AAPL");
  expect(anonymousQuote.status()).toBe(401);
  for (const operation of ["buy", "sell"]) {
    expect((await page.request.post(`/api/investments/${operation}`, { data: {
      accountId: identity.funded, symbol: "AAPL", amount: "100", shares: "1",
    } })).status()).toBe(401);
  }
  for (const currency of ["CAD", "GBP"]) {
    await db.query("UPDATE users SET display_currency=$1 WHERE id=$2", [currency, identity.userId]);
    // Unmount signed-in polling before ending the session.
    await page.goto("about:blank");
    await page.request.post("/api/logout");
    const before = await snapshot();
    let browserQuoteRequests = 0;
    // Even a legacy successful/stale quote response cannot appear or enable actions.
    await page.route("**/api/market/quote/**", route => {
      browserQuoteRequests++;
      return route.fulfill({ json: { symbol: "AAPL", price: 999999.99, change: 1,
        changePercent: 99, source: "synthetic", currency, asOf: "2000-01-01T00:00:00Z" } });
    });
    await login(page, identity);
    // Existing stored-value balance policy includes the extra 10 × 250 holding;
    // removing quotes must not alter that policy or convert nominal GBP amounts.
    await verifyHeadline(page, currency === "GBP" ? "£2,006,400.25" : "$2,006,400.25");
    await expect(page.getByText("Market Indices", { exact: true })).toHaveCount(0);
    await expect(page.locator("main").last()).not.toContainText(/Delayed 15 min|5,447\.21|0\.7341/);
    for (const symbol of ["AAPL", "SPY", "UNKNOWN", "aapl"]) {
      const response = await page.request.get(`/api/market/quote/${symbol}`);
      expect(response.status()).toBe(503);
      expect(response.headers()["cache-control"]).toBe("no-store");
      expect(await response.json()).toEqual(MARKET_UNAVAILABLE);
    }
    for (const quote of [
      null,
      { price: 250, source: "stored-holding", currency, asOf: new Date().toISOString() },
      { price: 250, source: "synthetic-provider", currency, asOf: "2000-01-01T00:00:00Z" },
      { price: 250, source: "synthetic-provider", currency: "USD", asOf: new Date().toISOString() },
      { price: 0, source: "synthetic-provider", currency, asOf: "invalid" },
    ]) {
      for (const symbol of ["AAPL", "SPY", "UNKNOWN"]) {
        for (const operation of ["buy", "sell"]) {
          const response = await page.request.post(`/api/investments/${operation}`, { data: {
            accountId: identity.funded, symbol,
            ...(operation === "buy" ? { amount: "100" } : { shares: "1" }), quote,
          } });
          expect(response.status()).toBe(503);
          expect(await response.json()).toEqual(MARKET_UNAVAILABLE);
        }
      }
    }
    await page.goto("/investments");
    await expect(page.getByTestId("market-trading-paused")).toHaveText("Trading is currently paused. Please contact your advisor.");
    await expect(page.getByText("Stock Quote", { exact: true })).toHaveCount(0);
    await expect(page.locator("main").last()).not.toContainText(/999,999\.99|999999\.99|99%/);
    await page.getByRole("combobox").filter({ hasText: "Select Account" }).click();
    await page.getByRole("option", { name: /^Funded Brokerage/ }).click();
    await page.getByPlaceholder("0.00", { exact: true }).fill("100");
    await expect(page.getByRole("button", { name: "Buy Stock", exact: true })).toBeDisabled();
    await page.getByRole("tab", { name: "Sell", exact: true }).click();
    await page.getByPlaceholder("0", { exact: true }).fill("1");
    await expect(page.getByRole("button", { name: "Sell Shares", exact: true })).toBeDisabled();
    await page.getByRole("tab", { name: "ETFs", exact: true }).click();
    await page.getByRole("combobox").filter({ hasText: "Select Account" }).click();
    await page.getByRole("option", { name: /^Funded Brokerage/ }).click();
    await page.getByPlaceholder("Any amount - fractional shares", { exact: true }).fill("100");
    await expect(page.getByRole("button", { name: "Buy Fractional Shares", exact: true })).toBeDisabled();
    await expect(page.getByText("Fractional Share Order Placed", { exact: true })).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole("button", { name: "Buy Stock", exact: true })).toBeDisabled();
    expect(browserQuoteRequests).toBe(0);
    expect(await snapshot()).toEqual(before);
    await page.screenshot({ path: test.info().outputPath(`pricing-paused-${currency}.png`), fullPage: true });
    await page.unroute("**/api/market/quote/**");
  }
});
