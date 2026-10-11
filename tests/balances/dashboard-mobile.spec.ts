import { test, expect, login, assertFundsActionBlocked } from "./fixtures";
import type { Page } from "@playwright/test";

// The page shell hides horizontal overflow. Checking document.scrollWidth alone
// cannot catch information clipped inside that shell or inside dashboard cards.
async function expectTextContained(page: Page, selector: string) {
  const clipped = await page.locator(selector).evaluateAll(elements => {
    const failures: string[] = [];
    for (const element of elements) {
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      let node: Node | null;
      while ((node = walker.nextNode())) {
        if (!node.textContent?.trim()) continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        for (const rect of Array.from(range.getClientRects())) {
          if (!rect.width || !rect.height) continue;
          let left = 0;
          let right = innerWidth;
          for (let parent = node.parentElement; parent; parent = parent.parentElement) {
            if (["hidden", "clip", "auto", "scroll"].includes(getComputedStyle(parent).overflowX)) {
              const bounds = parent.getBoundingClientRect();
              left = Math.max(left, bounds.left);
              right = Math.min(right, bounds.right);
            }
          }
          if (rect.left < left - 1 || rect.right > right + 1) {
            failures.push(`${node.textContent.trim()}: ${rect.left}..${rect.right}, available ${left}..${right}`);
          }
        }
      }
    }
    return failures;
  });
  expect(clipped, `${selector}: text must not require zooming out or horizontal scrolling`).toEqual([]);
}

test("dashboard information fits at normal mobile zoom without clipping amounts or holding fields", async ({ page, identity, db }, info) => {
  test.setTimeout(180000);
  const description = "Inheritance from family farm sale proceeds · Synthetic reference " + "FARMREFERENCE".repeat(8);
  const accountName = "Inheritance Trust Account with a long synthetic family settlement name";
  await db.query("UPDATE accounts SET display_name=$1 WHERE id=$2 AND user_id=$3", [accountName, identity.sixth, identity.userId]);
  const { rows: [deposit] } = await db.query(
    "INSERT INTO transactions(to_account_id,amount,description,transaction_type,status,is_demo) VALUES($1,1622886,$2,'transfer','completed',true) RETURNING id",
    [identity.sixth, description],
  );
  await db.query("UPDATE investments SET symbol=$1,shares=1234.5678,purchase_price=1314.52,current_price=1314.52 WHERE account_id=$2",
    ["SYNTHETIC_FAMILY_FARM_HOLDING", identity.funded]);
  const { rows: [holding] } = await db.query("SELECT * FROM investments WHERE account_id=$1", [identity.funded]);
  const snapshot = async () => Promise.all([
    "SELECT * FROM accounts WHERE user_id=$1 ORDER BY id",
    "SELECT * FROM investments WHERE account_id IN (SELECT id FROM accounts WHERE user_id=$1) ORDER BY id",
    "SELECT * FROM transactions WHERE from_account_id IN (SELECT id FROM accounts WHERE user_id=$1) OR to_account_id IN (SELECT id FROM accounts WHERE user_id=$1) ORDER BY id",
    "SELECT * FROM fee_enrollments WHERE user_id=$1 ORDER BY id",
    "SELECT * FROM fee_assessments WHERE account_id IN (SELECT id FROM accounts WHERE user_id=$1) ORDER BY id",
    "SELECT debt_clearance_required,debt_payment_account_id,debt_payment_confirmed_at FROM users WHERE id=$1",
  ].map(async sql => (await db.query(sql, [identity.userId])).rows));
  const before = await snapshot();
  for (const currency of ["GBP", "CAD"]) {
    await page.request.post("/api/logout");
    await db.query("UPDATE users SET display_currency=$1 WHERE id=$2", [currency, identity.userId]);
    await login(page, identity);
    await page.goto("/dashboard");
    const transaction = page.getByTestId(`txn-row-${deposit.id}`);
    const position = page.getByTestId(`holding-row-${holding.id}`);
    await expect(transaction).toContainText(currency === "GBP" ? "+£1,622,886.00" : "+CAD $1,622,886.00");
    await expect(transaction).toContainText(description);
    await expect(transaction).toContainText(accountName);
    await expect(transaction).toContainText("completed");
    await expect(position).toContainText("1234.5678");
    await expect(position).toContainText(currency === "GBP" ? "£1,314.52" : "CAD $1,314.52");
    await expect(position).toContainText(holding.symbol);
    const storedValue = Number(holding.shares) * Number(holding.current_price);
    await expect(position).toContainText(`${currency === "GBP" ? "£" : "CAD $"}${storedValue.toLocaleString("en-CA", {minimumFractionDigits:2,maximumFractionDigits:2})}`);
    for (const width of [320, 375, 390, 430, 640, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.evaluate(() => document.fonts.ready);
      expect(await page.evaluate(() => visualViewport?.scale)).toBe(1);
      await expect(page.getByTestId("button-quick-wire")).toHaveCount(0);
      await expectTextContained(page, `[data-testid="holding-row-${holding.id}"],[data-testid="txn-row-${deposit.id}"],[data-testid="text-total-balance"],[data-testid="button-quick-transfer"],[data-testid="button-quick-invest"],[data-testid="button-quick-accounts"]`);
      if ([320, 390, 768, 1440].includes(width)) {
        await page.screenshot({ path: info.outputPath(`${currency}-normal-zoom-${width}.png`), animations: "disabled" });
      }
      if (width === 768 || width === 1024) {
        await page.getByTestId("sidebar-toggle").click();
        await expect(page.getByTestId("sidebar-toggle")).toHaveAttribute("aria-expanded", "true");
        await page.waitForTimeout(300);
        await expectTextContained(page, `[data-testid="holding-row-${holding.id}"],[data-testid="txn-row-${deposit.id}"],[data-testid="text-total-balance"]`);
        await page.screenshot({ path: info.outputPath(`${currency}-sidebar-${width}.png`), animations: "disabled" });
        await page.getByTestId("sidebar-toggle").click();
        await page.waitForTimeout(300);
      }
    }
    await transaction.click();
    await expect(page.getByRole("dialog")).toContainText(description);
    await page.keyboard.press("Escape");
    await page.route("**/api/investments", route => route.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
    await page.setViewportSize({ width: 390, height: 1000 });
    await page.reload();
    await expect(page.getByText("No holdings yet", { exact: true })).toBeVisible();
    await expectTextContained(page, `[data-testid="txn-row-${deposit.id}"],[data-testid="text-total-balance"]`);
    await page.screenshot({ path: info.outputPath(`${currency}-empty-holdings.png`), animations: "disabled" });
    await page.unroute("**/api/investments");
  }
  expect(await snapshot()).toEqual(before);
  await db.query("UPDATE users SET debt_clearance_required=true WHERE id=$1", [identity.userId]);
  await page.reload();
  await assertFundsActionBlocked(page, "button-quick-transfer");
  await assertFundsActionBlocked(page, "button-quick-invest");
});
