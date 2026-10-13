import { test, expect, login, verifyHeadline, assertFundsActionBlocked } from "./fixtures";
import type pg from "pg";
import { assertReadable } from "./contrast-helper";

test.use({ expectedHttpFailures: {
  "/api/funds-access": 503,
  "/api/transactions/transfer": 423,
  "/api/investments/buy": 423,
  "/api/institutional-transfers": 423,
  "/api/accounts": 423,
  "/api/accounts/snapshot": 423,
  "/api/investments": 423,
  "/api/transactions": 423,
} });

async function snapshot(db: pg.Pool, userId: number) {
  const accounts = await db.query("SELECT * FROM accounts WHERE user_id=$1 ORDER BY id",[userId]);
  const fees = await db.query("SELECT f.* FROM fee_assessments f JOIN accounts a ON a.id=f.account_id WHERE a.user_id=$1 ORDER BY f.id",[userId]);
  const terms = await db.query("SELECT * FROM fee_enrollments WHERE user_id=$1 ORDER BY id",[userId]);
  const transactions = await db.query("SELECT t.* FROM transactions t WHERE t.from_account_id IN (SELECT id FROM accounts WHERE user_id=$1) OR t.to_account_id IN (SELECT id FROM accounts WHERE user_id=$1) ORDER BY id",[userId]);
  const policy = await db.query("SELECT display_currency,debt_clearance_required,debt_payment_account_id,debt_payment_confirmed_at,account_frozen FROM users WHERE id=$1",[userId]);
  const transfers = await db.query("SELECT * FROM institutional_transfers WHERE user_id=$1 ORDER BY id",[userId]);
  return {accounts:accounts.rows,fees:fees.rows,terms:terms.rows,transactions:transactions.rows,policy:policy.rows,transfers:transfers.rows};
}

test("blocked entry actions show a short popup without navigation or financial mutations", async ({page,identity,db}, info) => {
  test.setTimeout(120000);
  await db.query("UPDATE users SET display_currency='GBP',debt_clearance_required=true,debt_payment_account_id=$2 WHERE id=$1",[identity.userId,identity.debt]);
  await login(page,identity);
  await verifyHeadline(page,"£2,003,900.25");
  await expect(page.getByTestId("debt-restriction-unavailable")).toHaveCount(0);
  const before = await snapshot(db,identity.userId);
  const message = "Transfers and investing are blocked until your account debt is cleared.";
  await expect(page.locator('[data-testid^="button-quick-"]')).toHaveText(["Transfer", "Invest", "Accounts"]);
  await expect(page.getByTestId("button-quick-wire")).toHaveCount(0);
  for (const action of ["transfer","invest"]) {
    await assertFundsActionBlocked(page,`button-quick-${action}`);
    await expect(page.getByTestId(`button-quick-${action}`)).toBeFocused();
  }
  await page.getByRole("button",{name:"Manage",exact:true}).click();
  await expect(page.getByTestId("funds-action-dialog")).toContainText(message);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button",{name:"Manage",exact:true})).toBeFocused();
  await expect(page.getByTestId("sidebar-toggle")).toHaveAttribute("aria-expanded","false");
  await expect(page.getByTestId("profile-button")).toHaveAttribute("aria-label","Open profile");
  for (const width of [320,768,1440]) {
    await page.setViewportSize({width,height:900});
    await page.getByTestId("button-quick-invest").click();
    const dialog = page.getByTestId("funds-action-dialog");
    await expect(dialog).toContainText(message);
    await assertReadable(page,'[data-testid="funds-action-dialog"]',info,`debt-popup-${width}`);
    const box = await dialog.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(8);
    expect(box!.x+box!.width).toBeLessThanOrEqual(width-8);
    await page.screenshot({path:info.outputPath(`debt-action-${width}.png`)});
    await page.keyboard.press("Escape");
  }
  // Side navigation is deliberately awakened; blocked clicks must not navigate.
  await page.getByTestId("sidebar-toggle").click();
  const navigation = page.getByRole("button",{name:"Transfers",exact:true});
  await navigation.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("funds-action-dialog")).toContainText(message);
  await page.keyboard.press("Escape");
  await expect(navigation).toBeFocused();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.getByTestId("sidebar-close").click();
  await page.goto("/transfers");
  for (const entry of [
    page.getByTestId("button-new-institutional-transfer"),
    page.getByRole("button",{name:"Start a Transfer Request",exact:true}),
  ]) {
    await entry.click();
    await expect(page.getByTestId("funds-action-dialog")).toContainText(message);
    await expect(page.getByRole("dialog",{name:"Select Receiving Institution"})).toHaveCount(0);
    await page.keyboard.press("Escape");
  }
  await page.goto("/investments");
  await page.getByRole("button",{name:"Buy Stock",exact:true}).click();
  await expect(page.getByTestId("funds-action-dialog")).toContainText(message);
  await page.keyboard.press("Escape");
  await page.getByRole("tab",{name:"Sell",exact:true}).click();
  await page.getByRole("button",{name:"Sell Shares",exact:true}).click();
  await expect(page.getByTestId("funds-action-dialog")).toContainText(message);
  await page.keyboard.press("Escape");
  await page.getByRole("tab",{name:"ETFs",exact:true}).click();
  await page.getByRole("button",{name:"Buy Fractional Shares",exact:true}).click();
  await expect(page.getByTestId("funds-action-dialog")).toContainText(message);
  await page.keyboard.press("Escape");
  await page.goto("/accounts");
  await expect(page.getByText("Review accounts",{exact:true})).toHaveCount(0);
  await expect(page.getByText("Fiduciary accounts",{exact:true})).toHaveCount(0);
  // The fixture has both unpaid fees and overdraft: no reviewed-state shortcut.
  await expect(page.getByTestId(`debt-account-amount-${identity.debt}`)).toContainText("£1,614.39");
  await page.getByTestId(`account-row-${identity.debt}`).click();
  await page.goto("/accounts");
  await expect(page.getByTestId(`debt-account-amount-${identity.debt}`)).toContainText("£1,614.39");
  for (const [endpoint,data] of [
    ["/api/transactions/transfer",{fromAccountId:identity.funded,toAccountId:identity.extra,amount:"1.00"}],
    ["/api/investments/buy",{accountId:identity.funded,symbol:"TEST",amount:"1.00"}],
    ["/api/institutional-transfers",{accountId:identity.funded}],
  ] as const) {
    const response = await page.request.post(endpoint,{data});
    expect(response.status()).toBe(423);
    expect((await response.json()).message).toBe("DEBT_PAYMENT_REQUIRED");
  }
  expect(await snapshot(db,identity.userId)).toEqual(before);
});

test("failed and loading access checks stay blocked without a false debt reason", async ({page,identity,db}) => {
  test.setTimeout(120000);
  await db.query("UPDATE users SET debt_clearance_required=true,debt_payment_account_id=$2 WHERE id=$1",[identity.userId,identity.debt]);
  await page.route("**/api/funds-access",route=>route.fulfill({status:503,json:{message:"Synthetic access failure"}}));
  await login(page,identity);
  await verifyHeadline(page);
  await expect(page.getByTestId("debt-restriction-unavailable")).toContainText("We couldn't check access");
  await page.getByTestId("button-quick-transfer").click();
  const dialog = page.getByTestId("funds-action-dialog");
  await expect(dialog).toContainText("We couldn't check access to your funds.");
  await expect(dialog).not.toContainText("account debt");
  await expect(dialog.getByRole("button",{name:"Retry",exact:true})).toBeVisible();
  await page.unroute("**/api/funds-access");
  await dialog.getByRole("button",{name:"Retry",exact:true}).click();
  await expect(dialog).toContainText("Transfers and investing are blocked until your account debt is cleared.");
  await page.keyboard.press("Escape");
  let release!: () => void;
  const waiting = new Promise<void>(resolve=>{release=resolve;});
  await page.route("**/api/funds-access",async route=>{await waiting; await route.continue();});
  const request = page.waitForRequest(r=>r.url().endsWith("/api/funds-access"));
  await page.reload();
  await request;
  await page.getByTestId("button-quick-invest").click();
  await expect(dialog).toContainText("Please wait while we check access");
  await expect(dialog).not.toContainText("account debt");
  release();
  await expect(dialog).toContainText("Transfers and investing are blocked until your account debt is cleared.");
  await page.keyboard.press("Escape");
  await page.unroute("**/api/funds-access");
  // An error after verified cached debt must not continue presenting stale evidence.
  await page.route("**/api/funds-access",route=>route.fulfill({status:503,json:{message:"Synthetic polling failure"}}));
  await page.getByTestId("button-quick-transfer").click();
  await expect(dialog).toContainText("We couldn't check access",{timeout:22000});
  await expect(dialog).not.toContainText("account debt");
  await page.keyboard.press("Escape");
});

test("cleared debt awaiting verification stays locked and verified clearance restores entry", async ({page,identity,db}) => {
  await db.query("UPDATE users SET debt_clearance_required=true,debt_payment_account_id=$2 WHERE id=$1",[identity.userId,identity.debt]);
  await db.query("UPDATE accounts SET balance=0 WHERE id=$1",[identity.debt]);
  await db.query("UPDATE fee_assessments SET status='waived' WHERE id=$1",[identity.assessment]);
  await login(page,identity);
  await expect(page.getByTestId("debt-restriction-unavailable")).toHaveCount(0);
  await page.getByTestId("button-quick-transfer").click();
  await expect(page.getByTestId("funds-action-dialog")).toContainText("until your payment is verified");
  await expect(page.getByTestId("funds-action-dialog")).not.toContainText("account debt");
  await page.keyboard.press("Escape");
  // Only an isolated state fixture: real approval/payment lifecycle is covered by debt-summary.
  await db.query("UPDATE users SET debt_payment_confirmed_at=NOW() WHERE id=$1",[identity.userId]);
  await page.reload();
  await expect(page.getByTestId("debt-restriction-unavailable")).toHaveCount(0);
  await page.getByTestId("button-quick-transfer").click();
  await expect(page).toHaveURL(/\/transfers$/);
  await page.getByTestId("button-new-institutional-transfer").click();
  await expect(page.getByRole("dialog",{name:"Select Receiving Institution"})).toBeVisible();
  await page.keyboard.press("Escape");
  await page.goto("/investments");
  await expect(page.getByRole("button",{name:"Buy Stock",exact:true})).toBeDisabled();
  await expect(page.getByTestId("market-trading-paused")).toBeVisible();
});

test("ordinary debt and non-debt holds never create a fabricated debt restriction", async ({page,identity,db}) => {
  await login(page,identity);
  await verifyHeadline(page);
  await page.getByTestId("button-quick-transfer").click();
  await expect(page).toHaveURL(/\/transfers$/);
  await expect(page.getByTestId("funds-action-dialog")).toHaveCount(0);
  await db.query("UPDATE users SET account_frozen=true WHERE id=$1",[identity.userId]);
  await page.goto("/dashboard");
  await page.reload();
  await expect(page.getByText("Account on hold",{exact:true})).toBeVisible();
  await page.getByTestId("button-quick-invest").click();
  await expect(page).toHaveURL(/\/investments$/);
  await expect(page.getByTestId("funds-action-dialog")).toHaveCount(0);
  await expect(page.getByTestId("market-trading-paused")).toBeVisible();
});

test("an existing transfer form cannot submit after a debt lock takes effect", async ({page,identity,db}) => {
  test.setTimeout(90000);
  await db.query("UPDATE users SET debt_clearance_required=true,debt_payment_account_id=$2,debt_payment_confirmed_at=NOW() WHERE id=$1",[identity.userId,identity.debt]);
  await db.query("UPDATE accounts SET balance=0 WHERE id=$1",[identity.debt]);
  await db.query("UPDATE fee_assessments SET status='waived' WHERE id=$1",[identity.assessment]);
  await login(page,identity);
  await page.goto("/transfers");
  await page.getByTestId("button-new-institutional-transfer").click();
  await page.locator('[data-testid^="institution-option-"]').first().click();
  await page.getByTestId("input-institution-account-number").fill("SYNTHETIC-ONLY");
  await db.query("UPDATE accounts SET balance=-25 WHERE id=$1",[identity.debt]);
  const before = await snapshot(db,identity.userId);
  const locked = page.waitForResponse(async response=>
    response.url().endsWith("/api/funds-access") && response.status()===200 &&
    (await response.json()).locked===true,{timeout:25000});
  await locked;
  await page.getByTestId("button-submit-institutional-transfer").click();
  const dialog = page.getByTestId("funds-action-dialog");
  await expect(dialog).toContainText("Transfers and investing are blocked until your account debt is cleared.");
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("button-submit-institutional-transfer")).toBeFocused();
  await expect(page.getByRole("dialog",{name:"Full Portfolio Transfer"})).toBeVisible();
  expect(await snapshot(db,identity.userId)).toEqual(before);
});
