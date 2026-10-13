import { test, expect, login, assertFundsActionBlocked } from "./fixtures";
import { assertReadable } from "./contrast-helper";
import { formatBalance } from "../../shared/balance-currency";
import { maskAccountNumber } from "../../shared/account-display";
import type { Locator, Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

async function singleLine(figure: Locator) {
  const metrics = await figure.evaluate(el => {
    const range = document.createRange();
    range.selectNodeContents(el);
    const rects = Array.from(range.getClientRects()).filter(r => r.width > 0);
    let contained = true;
    for (let parent: HTMLElement | null = el as HTMLElement; parent; parent = parent.parentElement) {
      if (["hidden", "clip", "auto", "scroll"].includes(getComputedStyle(parent).overflowX)) {
        const bounds = parent.getBoundingClientRect();
        if (rects.some(r => r.left < bounds.left - 0.5 || r.right > bounds.right + 0.5)) contained = false;
      }
    }
    return { lines: new Set(rects.map(r => Math.round(r.top))).size, contained,
      right: Math.max(...rects.map(r => r.right)), viewport: innerWidth };
  });
  expect(metrics.lines).toBe(1);
  expect(metrics.contained).toBe(true);
  expect(metrics.right).toBeLessThanOrEqual(metrics.viewport);
}

async function fitsPage(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const outside = await page.locator("main").last().evaluate(main => {
    const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT);
    const outside: string[] = [];
    let node: Node | null;
    while ((node = walker.nextNode())) {
      if (!node.textContent?.trim() || !node.parentElement?.checkVisibility() || node.parentElement.closest(".sr-only")) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      if (Array.from(range.getClientRects()).some(r => r.width > 0 && (r.left < -1 || r.right > innerWidth + 1))) {
        outside.push(node.textContent.slice(0, 60));
      }
    }
    return outside;
  });
  expect(outside).toEqual([]);
}

for (const currency of ["CAD", "GBP"] as const) {
  test(`compact account detail preserves funded/debt history, controls and readable ${currency} figures`, async ({ page, identity, db }, info) => {
    test.setTimeout(180000);
    const money = (value: string) => formatBalance(value, currency);
    await db.query("UPDATE users SET display_currency=$2,debt_clearance_required=true,debt_payment_account_id=$3 WHERE id=$1",
      [identity.userId, currency, identity.debt]);
    await db.query("UPDATE accounts SET display_name='Brokerage Account' WHERE id=$1 AND user_id=$2",
      [identity.debt, identity.userId]);
    const trust = (await db.query(`INSERT INTO accounts(user_id,account_type,display_name,balance,is_demo,created_at)
      VALUES($1,'Trust Account','Inheritance Trust Account',0,true,'2026-10-12T16:00:00Z') RETURNING id,account_number`,
      [identity.userId])).rows[0];
    const description = "Inheritance — family farm sale proceeds";
    const client = await db.connect();
    let deposit: number;
    try {
      await client.query("BEGIN");
      await client.query("UPDATE accounts SET balance=balance+1622886 WHERE id=$1 AND user_id=$2", [trust.id, identity.userId]);
      deposit = (await client.query(`INSERT INTO transactions(to_account_id,amount,description,transaction_type,status,created_at)
        VALUES($1,1622886,$2,'transfer','completed','2026-10-12T16:00:00Z') RETURNING id`,
        [trust.id, description])).rows[0].id;
      await client.query("SELECT record_cash_posting($1,$2)", [deposit, trust.id]);
      await client.query("COMMIT");
    } catch (error) { await client.query("ROLLBACK"); throw error; }
    finally { client.release(); }
    const unsupported = (await db.query(`INSERT INTO transactions(from_account_id,amount,description,transaction_type,status,created_at)
      VALUES($1,12,$2,'transfer','completed','2026-10-11T16:00:00Z') RETURNING id`,
      [identity.debt, "A long recorded payment description for farm equipment and delivery with a reference retained in full"])).rows[0].id;
    const snapshot = async () => Promise.all([
      "SELECT * FROM accounts WHERE user_id=$1 ORDER BY id",
      "SELECT * FROM transactions WHERE from_account_id IN (SELECT id FROM accounts WHERE user_id=$1) OR to_account_id IN (SELECT id FROM accounts WHERE user_id=$1) ORDER BY id",
      "SELECT * FROM fee_enrollments WHERE user_id=$1 ORDER BY id",
      "SELECT * FROM fee_assessments WHERE account_id IN (SELECT id FROM accounts WHERE user_id=$1) ORDER BY id",
      "SELECT display_currency,debt_clearance_required,debt_payment_account_id,debt_payment_confirmed_at,account_frozen FROM users WHERE id=$1",
    ].map(async sql => (await db.query(sql, [identity.userId])).rows));
    const before = await snapshot();
    await login(page, identity);
    await assertFundsActionBlocked(page, "button-quick-transfer");
    const accessBefore = await (await page.request.get("/api/funds-access")).json();

    for (const width of [320, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const account of [
        { id: trust.id, name: "Inheritance Trust Account", amount: "1622886.00", transaction: deposit! },
        { id: identity.debt, name: "Brokerage Account", amount: "-1250.75", transaction: unsupported },
      ]) {
        await page.goto(`/accounts/${account.id}`);
        await expect(page.getByRole("heading", { name: account.name, exact: true })).toBeVisible();
        const primary = page.getByTestId("text-account-cash-balance");
        await expect(primary).toHaveText(money(account.amount));
        await page.evaluate(() => document.fonts.ready);
        await expect(page.getByTestId("account-detail-balance").getByText("Balance", { exact: true })).toHaveCount(1);
        await singleLine(primary);
        const row = page.getByTestId(`account-txn-row-${account.transaction}`);
        await expect(row).toBeVisible();
        const amount = row.locator("p").filter({ hasText: account.id === trust.id ? `+${money("1622886.00")}` : `-${money("12")}` }).first();
        await singleLine(amount);
        if (account.id === trust.id) {
          await expect(row).toContainText(description);
          const after = row.locator("[data-balance-after]");
          await expect(after).toContainText(money("1622886.00"));
          await singleLine(after.locator("span").last());
          const top = await amount.boundingBox();
          const bottom = await after.boundingBox();
          expect(bottom!.y).toBeGreaterThan(top!.y);
          expect(Math.abs(bottom!.x + bottom!.width - top!.x - top!.width)).toBeLessThan(2);
          await assertReadable(page, "[data-balance-after]", info, `${currency}-after-${width}`);
          await expect(page.locator("main").last()).toContainText(maskAccountNumber(trust.account_number));
        } else {
          await expect(row.locator("[data-balance-after]")).toHaveCount(0);
          await expect(primary).toHaveCSS("color", "rgb(185, 28, 28)");
          await expect(page.getByTestId("text-total-fee-debt")).toHaveText(money("363.64"));
        }
        const exportButton = page.getByTestId("button-export-statement");
        const heading = page.getByRole("heading", { name: "Transaction history", exact: true });
        const exportBounds = await exportButton.boundingBox();
        const headingBounds = await heading.boundingBox();
        expect(Math.abs(exportBounds!.y - headingBounds!.y)).toBeLessThan(32);
        if (width < 640) expect(exportBounds!.width).toBeLessThanOrEqual(44);
        await expect(page.getByRole("button", { name: "Account services", exact: true })).toHaveAttribute("aria-expanded", "false");
        await fitsPage(page);
        if ([768, 1024].includes(width)) {
          await page.getByTestId("sidebar-toggle").click();
          await expect(page.getByTestId("sidebar-toggle")).toHaveAttribute("aria-expanded", "true");
          // Measure the final sidebar width, not a frame within its CSS transition.
          await page.waitForTimeout(250);
          await singleLine(primary);
          await singleLine(amount);
          await fitsPage(page);
          await page.getByTestId("sidebar-close").click();
        }
        if (width === 390 || width === 1024) await page.screenshot({ path: info.outputPath(`${currency}-${account.name.split(" ")[0]}-${width}.png`), fullPage: true });
      }
    }
    await page.goto(`/accounts/${trust.id}`);
    await page.getByRole("button", { name: "Account details", exact: true }).click();
    await expect(page.getByRole("dialog")).toContainText(trust.account_number);
    await expect(page.getByRole("dialog")).not.toContainText(/IBAN|routing|Account ID:/);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "Account details", exact: true })).toBeFocused();
    const downloadEvent = page.waitForEvent("download");
    await page.getByTestId("button-export-statement").click();
    const download = await downloadEvent;
    expect(await readFile((await download.path())!, "utf8")).toContain('"1622886"');
    await page.getByTestId(`account-txn-row-${deposit!}`).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog")).toContainText(description);
    await expect(page.getByRole("dialog")).toContainText("Balance after transaction");
    await page.keyboard.press("Escape");
    expect(await snapshot()).toEqual(before);
    expect(await (await page.request.get("/api/funds-access")).json()).toEqual(accessBefore);
  });
}
