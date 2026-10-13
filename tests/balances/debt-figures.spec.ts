import { test, expect, login, verifyHeadline, assertFundsActionBlocked } from "./fixtures";
import { assertReadable } from "./contrast-helper";
import { formatBalance } from "../../shared/balance-currency";
import { maskAccountNumber } from "../../shared/account-display";
import type { Pool } from "pg";
import type { Locator } from "@playwright/test";

async function snapshot(db: Pool, userId: number) {
  return Promise.all([
    "SELECT * FROM accounts WHERE user_id=$1 ORDER BY id",
    "SELECT * FROM transactions WHERE from_account_id IN (SELECT id FROM accounts WHERE user_id=$1) OR to_account_id IN (SELECT id FROM accounts WHERE user_id=$1) ORDER BY id",
    "SELECT * FROM investments WHERE account_id IN (SELECT id FROM accounts WHERE user_id=$1) ORDER BY id",
    "SELECT * FROM fee_enrollments WHERE user_id=$1 ORDER BY id",
    "SELECT * FROM fee_assessments WHERE account_id IN (SELECT id FROM accounts WHERE user_id=$1) ORDER BY id",
    "SELECT display_currency,debt_clearance_required,debt_payment_account_id,debt_payment_confirmed_at FROM users WHERE id=$1",
  ].map(async sql=>(await db.query(sql,[userId])).rows));
}

async function redUnclipped(figure: Locator, width: number) {
  const metrics=await figure.evaluate(element=>{
    const range=document.createRange();
    range.selectNodeContents(element);
    const rects=Array.from(range.getClientRects()).filter(r=>r.width>0);
    const rgb=getComputedStyle(element).color.match(/[\d.]+/g)!.map(Number);
    let clipped=false;
    for(let parent=element;parent;parent=parent.parentElement!){
      if(["hidden","clip"].includes(getComputedStyle(parent).overflowX)){
        const bounds=parent.getBoundingClientRect();
        if(rects.some(r=>r.left<bounds.left || r.right>bounds.right+0.5)) clipped=true;
      }
    }
    return {red:rgb[0]>rgb[1] && rgb[0]>rgb[2],clipped,
      lines:new Set(rects.map(r=>Math.round(r.top))).size,
      right:Math.max(...rects.map(r=>r.right))};
  });
  expect(metrics.red).toBe(true);
  expect(metrics.clipped).toBe(false);
  expect(metrics.lines).toBe(1);
  expect(metrics.right).toBeLessThanOrEqual(width);
}

for(const currency of ["CAD","GBP"] as const){
  test(`debt figures and screen-specific captions stay readable and unchanged in ${currency}`,async ({page,identity,db},info)=>{
    test.setTimeout(120000);
    await db.query("UPDATE accounts SET account_type='Brokerage Account',display_name='Brokerage Account' WHERE id=$1 AND user_id=$2",[identity.debt,identity.userId]);
    await db.query("UPDATE users SET display_currency=$2,debt_clearance_required=true,debt_payment_account_id=$3 WHERE id=$1",[identity.userId,currency,identity.debt]);
    const before=await snapshot(db,identity.userId);
    await login(page,identity);
    const accessBefore=await (await page.request.get("/api/funds-access")).json();
    await assertFundsActionBlocked(page,"button-quick-transfer");
    for(const width of [320,390,768,1024,1440]){
      await page.setViewportSize({width,height:900});
      await page.goto("/dashboard");
      await verifyHeadline(page,formatBalance("2003900.25",currency));
      const card=page.getByTestId(`debt-account-${identity.debt}`);
      await expect(card.getByTestId(`debt-account-name-${identity.debt}`)).toBeVisible();
      await expect(card).not.toContainText("Amount owed");
      await expect(card.getByTestId(`debt-account-details-${identity.debt}`)).toHaveCount(0);
      for(const [id,value] of [
        [`debt-account-amount-${identity.debt}`,"-1614.39"],
        ["text-overdraft","-1250.75"],["text-unpaid-fees","-1614.39"],
      ]){
        const figure=page.getByTestId(id);
        await expect(figure).toHaveText(formatBalance(value,currency));
        await redUnclipped(figure,width);
        await assertReadable(page,`[data-testid="${id}"]`,info,`${currency}-dashboard-${id}-${width}`);
      }
      await expect(page.locator("main").last()).not.toContainText(/Negative cash balances|Outstanding assessments/);
      if(width===390) await page.screenshot({path:info.outputPath(`dashboard-${currency}.jpg`)});
      await page.goto("/accounts");
      await expect(page.getByTestId("text-total-balance")).toHaveText(formatBalance("2003900.25",currency));
      await expect(page.getByTestId(`debt-account-name-${identity.debt}`)).toHaveClass("sr-only");
      await expect(page.getByTestId("debt-account-summary")).toContainText("Amount owed");
      await expect(page.locator('[data-testid^="debt-account-details-"],[data-testid^="account-balance-label-"]')).toHaveCount(0);
      for(const id of [`debt-account-amount-${identity.debt}`,`balance-${identity.debt}`]){
        await redUnclipped(page.getByTestId(id),width);
        await assertReadable(page,`[data-testid="${id}"]`,info,`${currency}-accounts-${id}-${width}`);
      }
      await expect(page.getByTestId(`balance-${identity.debt}`)).toHaveText(formatBalance("-1250.75",currency));
      await expect(page.locator('[data-testid^="account-row-"],[data-testid^="account-group-"]').getByText("Balance",{exact:true})).toHaveCount(0);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
      if(width===390) await page.screenshot({path:info.outputPath(`accounts-${currency}.jpg`)});
    }
    await page.getByTestId("button-toggle-balances").click();
    await expect(page.getByTestId(`debt-account-amount-${identity.debt}`)).toHaveText("••••••");
    await expect(page.getByTestId(`balance-${identity.debt}`)).toHaveText("••••••");
    await page.getByTestId("button-toggle-balances").click();
    const account=page.getByTestId(`account-row-${identity.debt}`);
    await account.focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(new RegExp(`/accounts/${identity.debt}$`));
    await page.goto("/accounts");
    await page.getByTestId(`account-row-${identity.debt}`).focus();
    await page.keyboard.press("Space");
    await expect(page).toHaveURL(new RegExp(`/accounts/${identity.debt}$`));
    expect(await snapshot(db,identity.userId)).toEqual(before);
    expect(await (await page.request.get("/api/funds-access")).json()).toEqual(accessBefore);
  });
}

test("overdraft-only debt mirrors fees owed, negative groups stay red and cleared debt stays zero",async ({page,db,identity},info)=>{
  await db.query("UPDATE accounts SET balance=0 WHERE user_id=$1",[identity.userId]);
  await db.query("UPDATE accounts SET account_type='Brokerage Account',balance=-12398.48 WHERE id=$1 AND user_id=$2",[identity.debt,identity.userId]);
  await db.query("UPDATE accounts SET balance=1622886 WHERE id=$1 AND user_id=$2",[identity.sixth,identity.userId]);
  await db.query("DELETE FROM fee_assessments WHERE account_id IN (SELECT id FROM accounts WHERE user_id=$1)",[identity.userId]);
  await db.query("DELETE FROM investments WHERE account_id IN (SELECT id FROM accounts WHERE user_id=$1)",[identity.userId]);
  await db.query("UPDATE users SET display_currency='GBP',debt_clearance_required=true,debt_payment_account_id=$2 WHERE id=$1",[identity.userId,identity.debt]);
  const before=await snapshot(db,identity.userId);
  await login(page,identity);
  for(const id of ["text-overdraft","text-unpaid-fees"]) await expect(page.getByTestId(id)).toHaveText("-£12,398.48");
  await verifyHeadline(page,"£1,622,886.00");
  await assertFundsActionBlocked(page,"button-quick-invest");
  await page.goto("/accounts");
  const group=page.getByTestId("account-group-balance-investment");
  await expect(group).toHaveText("-£12,398.48");
  await redUnclipped(group,page.viewportSize()!.width);
  await assertReadable(page,'[data-testid="account-group-balance-investment"]',info,"negative-group");
  expect(await snapshot(db,identity.userId)).toEqual(before);
  // Changing only the disposable fixture proves clearance does not fabricate -0.
  await db.query("UPDATE accounts SET balance=0 WHERE id=$1 AND user_id=$2",[identity.debt,identity.userId]);
  await page.goto("/dashboard");
  for(const id of ["text-overdraft","text-unpaid-fees"]) await expect(page.getByTestId(id)).toHaveText("£0.00");
  await expect(page.getByTestId("debt-account-summary")).toHaveCount(0);
  await assertFundsActionBlocked(page,"button-quick-transfer");
});

test("multiple owed accounts retain masked permanent identities without details links",async ({page,db,identity})=>{
  await db.query("UPDATE accounts SET balance=-75 WHERE id=$1 AND user_id=$2",[identity.extra,identity.userId]);
  const accounts=(await db.query("SELECT id,account_number FROM accounts WHERE user_id=$1 AND id=ANY($2)",[identity.userId,[identity.debt,identity.extra]])).rows;
  const before=await snapshot(db,identity.userId);
  await login(page,identity);
  await page.goto("/accounts");
  for(const account of accounts){
    const card=page.getByTestId(`debt-account-${account.id}`);
    await expect(card).toContainText(maskAccountNumber(account.account_number));
    await expect(card).toContainText("Amount owed");
    await expect(card.getByTestId(`debt-account-name-${account.id}`)).toHaveClass("sr-only");
    await expect(card.getByTestId(`debt-account-details-${account.id}`)).toHaveCount(0);
  }
  expect(await snapshot(db,identity.userId)).toEqual(before);
});

test.use({expectedHttpFailures:{"/api/fees/summary":503}});
test("missing or malformed debt evidence cannot display a false zero",async ({page,identity})=>{
  await login(page,identity);
  await page.route("**/api/fees/summary",route=>route.fulfill({status:503,json:{message:"Isolated failed debt evidence"}}));
  await page.reload();
  await expect(page.getByTestId("text-unpaid-fees")).toHaveText("Unavailable");
  await expect(page.getByTestId("text-overdraft")).toHaveText("CAD -$1,250.75");
  await page.unroute("**/api/fees/summary");
  await page.route("**/api/fees/summary",async route=>{
    const response=await route.fetch();
    const summary=await response.json();
    await route.fulfill({json:{...summary,totalUnpaid:"NaN",totalOwed:"0"}});
  });
  await page.reload();
  await expect(page.getByTestId("text-unpaid-fees")).toHaveText("Unavailable");
  await expect(page.getByTestId("text-total-balance")).toHaveText("CAD $2,003,900.25");
});
