import { test, expect, login } from "./fixtures";
import { readFile } from "node:fs/promises";

test("plain overdrafts and fee descriptions preserve records, currencies and distinct unpaid fees", async ({ page, identity, db }, info) => {
  test.setTimeout(180000);
  const originalDescription = "CAD monthly service fee · 2026-05-01 · Assessment 61 · Authorized fee overdraft";
  await db.query("UPDATE accounts SET account_type='Brokerage Account',display_name='Brokerage Account' WHERE id=$1 AND user_id=$2", [identity.debt, identity.userId]);
  const { rows: [fee] } = await db.query(`INSERT INTO transactions(from_account_id,amount,description,transaction_type,status,created_at)
    VALUES($1,363.64,$2,'fee','completed','2026-05-01T14:00:00Z') RETURNING id`, [identity.debt, originalDescription]);
  const { rows: [other] } = await db.query(`INSERT INTO transactions(from_account_id,amount,description,transaction_type,status,created_at)
    VALUES($1,12,'Farm invoice 61 · 2026-04-30','transfer','completed','2026-04-30T14:00:00Z') RETURNING id`, [identity.debt]);
  const snapshot = async () => ({
    accounts: (await db.query("SELECT * FROM accounts WHERE user_id=$1 ORDER BY id", [identity.userId])).rows,
    transactions: (await db.query("SELECT * FROM transactions WHERE from_account_id IN (SELECT id FROM accounts WHERE user_id=$1) OR to_account_id IN (SELECT id FROM accounts WHERE user_id=$1) ORDER BY id", [identity.userId])).rows,
    fees: (await db.query("SELECT * FROM fee_assessments WHERE account_id IN (SELECT id FROM accounts WHERE user_id=$1) ORDER BY id", [identity.userId])).rows,
    contracts: (await db.query("SELECT * FROM fee_enrollments WHERE user_id=$1 ORDER BY id", [identity.userId])).rows,
    policy: (await db.query("SELECT debt_clearance_required,debt_payment_account_id,debt_payment_confirmed_at,account_frozen FROM users WHERE id=$1", [identity.userId])).rows,
  });
  for (const currency of ["GBP", "CAD"]) {
    await page.goto("about:blank");
    await page.request.post("/api/logout");
    await db.query("UPDATE users SET display_currency=$1 WHERE id=$2", [currency, identity.userId]);
    await login(page, identity);
    const money = (amount: string) => currency === "GBP" ? `£${amount}` : `CAD $${amount}`;
    for (const state of [
      { cash: "-1250.75", unpaid: false, total: "1,250.75", kind: "overdraft" },
      { cash: "-1250.75", unpaid: true, total: "1,614.39", kind: "mixed" },
      { cash: "100.00", unpaid: true, total: "363.64", kind: "unpaid" },
      { cash: "0.00", unpaid: false, total: null, kind: "zero" },
    ]) {
      await page.goto("about:blank");
      await db.query("UPDATE accounts SET balance=$1 WHERE id=$2 AND user_id=$3", [state.cash, identity.debt, identity.userId]);
      await db.query("UPDATE fee_assessments SET status=$1 WHERE id=$2 AND account_id=$3", [state.unpaid ? "unpaid" : "waived", identity.assessment, identity.debt]);
      const before = await snapshot();
      await page.goto(`/accounts/${identity.debt}`);
      const balance = page.getByTestId("account-detail-balance");
      await expect(balance).toBeVisible();
      await expect(balance).not.toContainText(/ledger|assessments|No interest|posted fee/i);
      if (state.total) await expect(balance.getByTestId("text-total-fee-debt")).toHaveText(money(state.total));
      else await expect(balance.getByTestId("text-total-fee-debt")).toHaveCount(0);
      if (state.kind === "overdraft") {
        await expect(balance).toContainText("Brokerage Account");
        await expect(balance).toContainText("Overdraft");
        await expect(balance).toContainText("owed");
        await expect(balance).not.toContainText("Unpaid fees");
        expect((await balance.innerText()).split(money("1,250.75")).length - 1).toBe(1);
      } else if (state.kind === "mixed") {
        await expect(balance.getByTestId(`text-account-overdraft-${identity.debt}`)).toHaveText(`Overdraft ${money("1,250.75")}`);
        await expect(balance.getByTestId(`text-account-unpaid-fees-${identity.debt}`)).toHaveText(`Unpaid fees ${money("363.64")}`);
      } else {
        await expect(balance).not.toContainText("Overdraft");
        await expect(balance.getByTestId("text-account-cash-balance")).toHaveText(money(state.kind === "zero" ? "0.00" : "100.00"));
        if (state.kind === "unpaid") await expect(balance.getByTestId("text-account-net-balance")).toHaveText(currency === "GBP" ? "-£263.64" : "CAD -$263.64");
      }
      if (currency === "GBP") await expect(balance).not.toContainText(/\bCAD\b|\bGBP\b/);
      const row = page.getByTestId(`account-txn-row-${fee.id}`);
      await expect(row).toContainText("Monthly service fee");
      await expect(row).toContainText("May 1, 2026");
      await expect(row).not.toContainText(/2026-05-01|Assessment 61|Authorized fee overdraft/);
      expect((await row.innerText()).split("May 1, 2026").length - 1).toBe(1);
      await expect(page.getByTestId(`account-txn-row-${other.id}`)).toContainText("Farm invoice 61 · 2026-04-30");
      if (state.kind === "overdraft") {
        for (const width of [320, 768, 1440]) {
          await page.setViewportSize({ width, height: 1000 });
          await page.evaluate(() => document.fonts.ready);
          await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
          const amount = balance.getByTestId("text-total-fee-debt");
          const geometry = await amount.evaluate(element => {
            const range = document.createRange(); range.selectNodeContents(element);
            const rects = Array.from(range.getClientRects());
            return { lines: new Set(rects.map(r => Math.round(r.top))).size, right: Math.max(...rects.map(r => r.right)) };
          });
          expect(geometry.lines).toBe(1);
          expect(geometry.right).toBeLessThanOrEqual(width);
          if (currency === "GBP") await page.screenshot({ path: info.outputPath(`simple-overdraft-${width}.png`), fullPage: false });
        }
        await page.setViewportSize({ width: 390, height: 844 });
        await row.click();
        const dialog = page.getByRole("dialog");
        await expect(dialog).toContainText("Monthly service fee");
        await expect(dialog).not.toContainText(/Assessment 61|Authorized fee overdraft|2026-05-01/);
        await dialog.getByRole("button", { name: "Close", exact: true }).first().click();
        const download = page.waitForEvent("download");
        await page.getByRole("button", { name: "Export", exact: true }).click();
        const csv = await readFile(await (await download).path(), "utf8");
        expect(csv).toContain('"Monthly service fee"');
        expect(csv).toContain('"May 1, 2026"');
        expect(csv).toContain('"-363.64"');
        expect(csv).not.toContain("Assessment 61");
        expect(csv).not.toContain("Authorized fee overdraft");
        expect(csv).toContain('"Farm invoice 61 · 2026-04-30"');
        await page.goto("/dashboard");
        const recent = page.getByTestId(`txn-row-${fee.id}`);
        await expect(recent).toContainText("Monthly service fee");
        await expect(recent).not.toContainText("Assessment 61");
        await recent.click();
        await expect(page.getByRole("dialog")).toContainText("Monthly service fee");
        await expect(page.getByRole("dialog")).not.toContainText(/Assessment 61|Authorized fee overdraft/);
        await page.getByRole("dialog").getByRole("button", { name: "Close", exact: true }).first().click();
      }
      await page.goto("/accounts");
      if (state.total) await expect(page.getByTestId(`debt-account-amount-${identity.debt}`)).toHaveText(money(state.total));
      else await expect(page.getByTestId("debt-account-summary")).toHaveCount(0);
      if (state.kind === "overdraft") {
        const accountRow = page.getByTestId(`account-row-${identity.debt}`);
        await expect(accountRow).toContainText("Overdraft");
        expect((await accountRow.innerText()).split(money("1,250.75")).length - 1).toBe(1);
        await page.getByTestId("button-toggle-balances").click();
        await expect(page.getByTestId(`debt-account-amount-${identity.debt}`)).toHaveText("••••••");
        await expect(accountRow).not.toContainText("1,250.75");
      }
      await expect(page.getByTestId("sidebar-toggle")).toHaveAttribute("aria-expanded", "false");
      await expect(page.getByTestId("top-navigation-toggle")).toHaveAttribute("aria-expanded", "false");
      expect(await snapshot()).toEqual(before);
    }
  }
});

test("loading, account fee failures and failed history remain explicit without zero debt or empty exports", async ({ page, identity }, info) => {
  test.setTimeout(90000);
  await login(page, identity);
  let release!: () => void;
  const held = new Promise<void>(done => { release = done; });
  await page.route("**/api/fees/summary", async route => { await held; await route.continue(); });
  await page.goto(`/accounts/${identity.debt}`);
  const balance = page.getByTestId("account-detail-balance");
  await expect(balance.getByRole("status")).toContainText("Checking account balances and fees");
  await expect(balance.getByTestId("text-total-fee-debt")).toHaveCount(0);
  release();
  await expect(balance.getByTestId("text-total-fee-debt")).toHaveText("CAD $1,614.39");
  await page.unroute("**/api/fees/summary");
  await page.route("**/api/fees/summary", route => route.fulfill({ status: 503, json: { message: "Synthetic fee failure" } }));
  await page.reload();
  await expect(balance.getByRole("alert")).toContainText("Account fee details could not be loaded");
  await expect(balance.getByTestId("text-total-fee-debt")).toHaveCount(0);
  await page.unroute("**/api/fees/summary");
  await balance.getByRole("button", { name: "Retry" }).click();
  await expect(balance.getByTestId("text-total-fee-debt")).toHaveText("CAD $1,614.39");
  await page.route(`**/api/accounts/${identity.debt}/transactions`, route => route.fulfill({ status: 503, json: { message: "Synthetic history failure" } }));
  await page.reload();
  await expect(page.getByRole("alert").filter({ hasText: "Transaction history could not be loaded" })).toBeVisible();
  await expect(page.getByTestId("button-export-statement")).toBeDisabled();
  await expect(page.getByText("No transactions yet", { exact: true })).toHaveCount(0);
  await expect(page.getByTestId("button-retry-transactions")).toBeVisible();
  await page.unroute(`**/api/accounts/${identity.debt}/transactions`);
  if (await page.getByTestId("button-retry-transactions").isVisible()) await page.getByTestId("button-retry-transactions").click();
  await expect(page.getByTestId("button-export-statement")).toBeEnabled();
  await page.route("**/api/accounts", route => route.fulfill({ status: 503, json: { message: "Synthetic account failure" } }));
  await page.reload();
  await expect(page.getByRole("alert")).toContainText("Account details could not be loaded");
  await expect(page.getByText("Account not found", { exact: true })).toHaveCount(0);
});
