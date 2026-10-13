import { test, expect, login } from "./fixtures";

test("account details are clean, truthful and responsive without changing fees or history", async ({ page, identity, db }, info) => {
  test.setTimeout(180000);
  await db.query("UPDATE users SET display_currency='GBP' WHERE id=$1", [identity.userId]);
  await db.query("UPDATE accounts SET created_at='2024-01-01T17:00:00Z' WHERE id=$1 AND user_id=$2", [identity.debt, identity.userId]);
  const { rows: [fee] } = await db.query(`INSERT INTO transactions(from_account_id,amount,description,transaction_type,status,created_at)
    VALUES($1,363.64,'CAD monthly service fee · 2026-05-01 · Assessment 61 · Authorized fee overdraft','fee','completed','2026-05-01T14:00:00Z') RETURNING id`, [identity.debt]);
  const longDescription = "Payment for farm equipment and delivery ".repeat(5).trim();
  const { rows: [other] } = await db.query(`INSERT INTO transactions(from_account_id,amount,description,transaction_type,status,created_at)
    VALUES($1,12,$2,'transfer','completed','2026-04-30T14:00:00Z') RETURNING id`, [identity.debt, longDescription]);
  const snapshot = async () => ({
    accounts: (await db.query("SELECT * FROM accounts WHERE user_id=$1 ORDER BY id", [identity.userId])).rows,
    transactions: (await db.query("SELECT * FROM transactions WHERE from_account_id IN (SELECT id FROM accounts WHERE user_id=$1) OR to_account_id IN (SELECT id FROM accounts WHERE user_id=$1) ORDER BY id", [identity.userId])).rows,
    enrollments: (await db.query("SELECT * FROM fee_enrollments WHERE user_id=$1 ORDER BY id", [identity.userId])).rows,
    assessments: (await db.query("SELECT * FROM fee_assessments WHERE account_id IN (SELECT id FROM accounts WHERE user_id=$1) ORDER BY id", [identity.userId])).rows,
    policy: (await db.query("SELECT display_currency,debt_clearance_required,debt_payment_account_id,debt_payment_confirmed_at,account_frozen FROM users WHERE id=$1", [identity.userId])).rows,
  });
  const before = await snapshot();
  await login(page, identity);
  await page.goto(`/accounts/${identity.debt}`);
  const balance = page.getByTestId("account-detail-balance");
  await expect(balance).toContainText("-£1,250.75");
  await expect(balance).toContainText("£363.64");
  await expect(page.getByText("Account ID:", { exact: false })).toHaveCount(0);
  const detailsButton = page.getByRole("button", { name: "Account details", exact: true });
  const accountHeader = balance.locator("..");
  await expect(accountHeader.getByRole("heading")).toBeVisible();
  await expect(accountHeader.getByRole("button", { name: "Account details", exact: true })).toBeVisible();
  expect(await detailsButton.evaluate(button => {
    const masked = button.previousElementSibling;
    return masked?.tagName === "P" && !!masked.textContent?.includes("••");
  })).toBe(true);
  await detailsButton.focus();
  await page.keyboard.press("Enter");
  const details = page.getByRole("dialog");
  await expect(details.getByText("Balance Test Client", { exact: true })).toBeVisible();
  await expect(page.getByText(identity.ref, { exact: true })).toHaveCount(0);
  await expect(details.getByText("January 1, 2024", { exact: true })).toBeVisible();
  const { rows: [account] } = await db.query("SELECT account_number FROM accounts WHERE id=$1", [identity.debt]);
  await expect(details).toContainText(account.account_number);
  await expect(details).not.toContainText("IBAN");
  await expect(details).not.toContainText("routing");
  await page.keyboard.press("Escape");
  await expect(detailsButton).toBeFocused();
  for (const phrase of ["Monthly service fees", "Enrollment status", "Discretionary management", "Fee history", "PROCESSING CURRENTLY DISABLED"]) {
    await expect(page.getByText(phrase, { exact: false })).toHaveCount(0);
  }
  const services = page.getByRole("button", { name: /^(Hide )?account services$/i });
  await expect(services).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByTestId(`account-txn-row-${fee.id}`)).toContainText("Monthly service fee");
  await expect(page.getByTestId(`account-txn-row-${fee.id}`)).not.toContainText("Assessment");
  await expect(page.getByTestId(`account-txn-row-${fee.id}`)).toContainText("-£363.64");
  await expect(page.getByTestId(`account-txn-row-${other.id}`)).toContainText(longDescription);
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(balance).toBeVisible();
    {
      const headingBox = await accountHeader.getByRole("heading").boundingBox();
      const figureBox = await balance.boundingBox();
      expect(figureBox!.x).toBeGreaterThan(headingBox!.x + headingBox!.width);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    const overflow = await page.locator("main").last().evaluate((main) => {
      const bad: string[] = [];
      const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT);
      let node: Node | null;
      while ((node = walker.nextNode())) {
        if (!node.textContent?.trim() || !(node.parentElement instanceof HTMLElement)) continue;
        if (!node.parentElement.checkVisibility()) continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        for (const rect of Array.from(range.getClientRects())) {
          if (rect.width && (rect.left < -1 || rect.right > window.innerWidth + 1)) bad.push(node.textContent.slice(0, 70));
        }
      }
      return bad;
    });
    expect(overflow, `Text must fit at ${width}px`).toEqual([]);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: info.outputPath("clean-account-details-mobile.png"), fullPage: true });
  await services.click();
  await expect(services).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByText("Enrollment status", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "End enrollment", exact: true })).toBeVisible();
  await services.click();
  await expect(services).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByText("Enrollment status", { exact: true })).toHaveCount(0);
  const row = page.getByTestId(`account-txn-row-${other.id}`);
  await row.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText(longDescription);
  await expect(dialog).toContainText("£12.00");
  expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  await dialog.getByRole("button", { name: "Close", exact: true }).first().click();
  const download = page.waitForEvent("download");
  await page.getByTestId("button-export-statement").click();
  expect((await download).suggestedFilename()).toContain("-statement.csv");
  expect(await snapshot()).toEqual(before);
});
