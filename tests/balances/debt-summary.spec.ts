import { test, expect, login, verifyHeadline, assertFundsActionBlocked } from "./fixtures";

test.use({ expectedHttpFailures: { "/api/funds-access": 503 } });

test("normal debt card stays separate from admin provenance and preserves locked funds", async ({ page, identity, db }, info) => {
  const path = `/api/admin/users/${identity.userId}/debt-restriction`;
  const admin = { "x-admin-key": process.env.BALANCE_E2E_ADMIN! };
  const name = "Synthetic Brokerage Account — Discretionary Management";
  await db.query("UPDATE users SET display_currency='GBP' WHERE id=$1", [identity.userId]);
  await db.query("UPDATE accounts SET account_type='Brokerage Account',display_name=$1 WHERE id=$2 AND user_id=$3",
    [name, identity.debt, identity.userId]);
  await login(page, identity);
  await verifyHeadline(page, "£2,003,900.25");
  const card = page.getByTestId(`debt-account-${identity.debt}`);
  await expect(card).toContainText(name);
  await expect(card).not.toContainText("Amount owed");
  await expect(card).not.toContainText("GBP");
  await expect(card).not.toContainText("CAD");
  await expect(page.getByTestId(`debt-account-amount-${identity.debt}`)).toHaveText("-£1,614.39");
  expect((await card.innerText()).split("£1,614.39").length - 1).toBe(1);
  await expect(page.getByTestId("debt-restriction-status")).toHaveCount(0);
  await expect(page.getByTestId("debt-restriction-unavailable")).toHaveCount(0);
  for (const width of [320,390,768,1024,1440]) {
    await page.setViewportSize({width,height:1000});
    await card.scrollIntoViewIfNeeded();
    await page.evaluate(() => document.fonts.ready);
    const geometry = await card.evaluate(element => {
      const cardBox=element.getBoundingClientRect();
      const name=element.querySelector("h3")!;
      const money=element.querySelector('[data-testid^="debt-account-amount-"]')!;
      const range=document.createRange(); range.selectNodeContents(money);
      const rects=Array.from(range.getClientRects());
      return {nameClipped:name.scrollWidth>name.clientWidth+1,
        moneyLines:new Set(rects.map(r=>Math.round(r.top))).size,
        moneyClipped:rects.some(r=>r.right>cardBox.right || r.left<cardBox.left)};
    });
    expect(geometry).toEqual({nameClipped:false,moneyLines:1,moneyClipped:false});
    if ([390,1024,1440].includes(width)) {
      await page.screenshot({path:info.outputPath(`ordinary-debt-${width}.png`),fullPage:false});
    }
  }
  // Merely owing money cannot be confirmed as an administrative restriction.
  expect((await page.request.post(path,{headers:admin,data:{confirmed:true,reason:"Synthetic admin review"}})).status()).toBe(409);
  await db.query("UPDATE users SET debt_clearance_required=true,debt_payment_account_id=$2 WHERE id=$1",
    [identity.userId,identity.debt]);
  await page.reload();
  await expect(page.getByText("Restriction details unavailable.",{exact:true})).toHaveCount(0);
  await assertFundsActionBlocked(page,"button-quick-transfer");
  const financialSnapshot = async () => {
    const accounts=await db.query("SELECT id,balance FROM accounts WHERE user_id=$1 ORDER BY id",[identity.userId]);
    const assessment=await db.query("SELECT total,status FROM fee_assessments WHERE id=$1",[identity.assessment]);
    const policy=await db.query("SELECT debt_clearance_required,debt_payment_account_id,debt_payment_confirmed_at FROM users WHERE id=$1",[identity.userId]);
    return {accounts:accounts.rows,assessment:assessment.rows,policy:policy.rows};
  };
  const before=await financialSnapshot();
  expect((await page.request.post(path,{data:{confirmed:true,reason:"Unauthorized client attempt"}})).status()).toBe(401);
  expect((await page.request.post(path,{headers:{"x-admin-key":"invalid"},data:{confirmed:true,reason:"Unauthorized attempt"}})).status()).toBe(401);
  expect((await page.request.post(path,{headers:admin,data:{confirmed:true,reason:""}})).status()).toBe(400);
  expect((await page.request.patch("/api/user",{data:{debtClearanceRequired:false}})).status()).toBe(403);
  expect((await page.request.post(path,{headers:admin,data:{confirmed:true,reason:"Synthetic admin debt restriction review"}})).status()).toBe(200);
  await page.reload();
  await expect(page.getByTestId("debt-restriction-status")).toContainText("Please contact your advisor");
  await expect(page.getByTestId("debt-restriction-status")).not.toContainText("sign in");
  await expect(page.getByTestId("debt-restriction-status")).not.toContainText("1,614.39");
  await verifyHeadline(page, "£2,003,900.25");
  await assertFundsActionBlocked(page,"button-quick-invest");
  for (const [endpoint,data] of [
    ["/api/transactions/transfer",{fromAccountId:identity.funded,toAccountId:identity.extra,amount:"1.00"}],
    ["/api/investments/buy",{accountId:identity.funded,symbol:"TEST",amount:"1.00"}],
  ] as const) {
    // Verify the server gate, not just disabled buttons.
    const response=await page.request.post(endpoint,{data});
    expect(response.status()).toBe(423);
    expect((await response.json()).message).toBe("DEBT_PAYMENT_REQUIRED");
  }
  expect(await financialSnapshot()).toEqual(before);
  await page.route("**/api/funds-access", route=>route.fulfill({status:503,json:{message:"Synthetic missing access evidence"}}));
  await page.reload();
  await expect(page.getByTestId("debt-restriction-unavailable")).toContainText("We couldn't check access");
  await expect(page.getByTestId("debt-restriction-status")).toHaveCount(0);
  await assertFundsActionBlocked(page,"button-quick-transfer");
  await page.unroute("**/api/funds-access");
  await page.getByTestId("debt-restriction-unavailable").getByRole("button",{name:"Retry"}).click();
  await expect(page.getByTestId("debt-restriction-status")).toBeVisible();
  expect((await page.request.post(path,{headers:admin,data:{confirmed:false,reason:"Synthetic notice withdrawn, lock retained"}})).status()).toBe(200);
  await page.reload();
  await expect(page.getByTestId("debt-restriction-status")).toHaveCount(0);
  await assertFundsActionBlocked(page,"button-quick-transfer");
  expect(await financialSnapshot()).toEqual(before);
  // Even a zero ledger is not verified separate payment.
  await db.query("UPDATE accounts SET balance=0 WHERE id=$1 AND user_id=$2",[identity.debt,identity.userId]);
  const waived=await page.request.post(`/api/admin/fees/assessments/${identity.assessment}/waive`,
    {headers:admin,data:{confirmed:true,reason:"Synthetic clearance state only"}});
  expect(waived.ok(),await waived.text()).toBeTruthy();
  expect((await (await page.request.get("/api/funds-access")).json()).locked).toBe(true);
  // Retain an active confirmation through clearance, rather than hiding the
  // regression by withdrawing every notice before a payment is recorded.
  expect((await page.request.post(path,{headers:admin,data:{confirmed:true,reason:"Synthetic current restriction reconfirmed"}})).status()).toBe(200);
  const deposit=await page.request.post("/api/transactions/transfer",
    {data:{fromAccountId:-1,toAccountId:identity.debt,amount:"1.00"}});
  expect(deposit.status()).toBe(201);
  const pending=await deposit.json();
  expect(await (await page.request.get("/api/funds-access")).json())
    .toMatchObject({locked:true,debtRestrictionConfirmed:true});
  const approved=await page.request.post(`/api/admin/transactions/${pending.id}/approve`,{headers:admin});
  expect(approved.ok(),await approved.text()).toBeTruthy();
  const cleared=await (await page.request.get("/api/funds-access")).json();
  expect(cleared).toMatchObject({locked:false,paymentRecorded:true,debtRestrictionConfirmed:false});
  expect(Number(cleared.totalOwed)).toBe(0);
  await page.reload();
  await expect(page.getByTestId("debt-account-summary")).toHaveCount(0);
  await expect(page.getByTestId("debt-restriction-status")).toHaveCount(0);
  await expect(page.getByTestId("button-quick-transfer")).toBeEnabled();
  // New debt on exactly the same account cannot revive the old decision.
  await db.query("UPDATE accounts SET balance=-1250.75 WHERE id=$1 AND user_id=$2",[identity.debt,identity.userId]);
  const renewed=await (await page.request.get("/api/funds-access")).json();
  expect(renewed).toMatchObject({locked:true,paymentRecorded:true,debtRestrictionConfirmed:false});
  await page.reload();
  await expect(page.getByTestId("debt-restriction-status")).toHaveCount(0);
  await expect(page.getByText("Restriction details unavailable.",{exact:true})).toHaveCount(0);
  await assertFundsActionBlocked(page,"button-quick-transfer");
  expect((await page.request.post(path,{headers:admin,data:{confirmed:true,reason:"Synthetic administrator reviews renewed debt"}})).status()).toBe(200);
  await page.reload();
  await expect(page.getByTestId("debt-restriction-status")).toBeVisible();
  const audit=await db.query("SELECT actor,detail FROM fee_audit WHERE action='debt_restriction_notice' AND detail->>'userId'=$1 ORDER BY id",
    [String(identity.userId)]);
  expect(audit.rows.map(row=>row.detail.confirmed)).toEqual([true,false,true,true]);
  expect(audit.rows[2].detail.clearanceEvidenceKey).not.toBe(audit.rows[3].detail.clearanceEvidenceKey);
  expect(audit.rows.every(row=>row.actor==="admin" && row.detail.scope==="funds")).toBe(true);
});

test("admin notice controls record provenance without changing generic holds or payment policy", async ({page,identity,db,browser}) => {
  await db.query("UPDATE users SET debt_clearance_required=true,debt_payment_account_id=$2 WHERE id=$1",
    [identity.userId,identity.debt]);
  await login(page,identity);
  const context=await browser.newContext({baseURL:process.env.BALANCE_E2E_URL});
  try {
    const adminPage=await context.newPage();
    await adminPage.goto("/admin");
    await adminPage.getByTestId("input-admin-password").fill(process.env.BALANCE_E2E_ADMIN!);
    await adminPage.getByTestId("button-admin-login").click();
    await adminPage.getByRole("tab",{name:/Users/}).click();
    await adminPage.getByTestId(`debt-notice-admin-${identity.userId}`).click();
    const panel=adminPage.getByRole("dialog");
    await expect(panel).toContainText("admin debt reason not yet confirmed");
    await expect(panel.getByTestId("confirm-debt-notice")).toBeDisabled();
    await panel.getByLabel("Reason for this notice decision").fill("Synthetic administrative confirmation");
    await panel.getByTestId("confirm-debt-notice").click();
    await expect(panel).toContainText("Debt restriction confirmed.");
    await page.reload();
    await expect(page.getByTestId("debt-restriction-status")).toBeVisible();
    await panel.getByLabel("Reason for this notice decision").fill("Synthetic notice withdrawn without releasing funds");
    await panel.getByTestId("withdraw-debt-notice").click();
    await expect(panel).toContainText("admin debt reason not yet confirmed");
    await page.reload();
    await expect(page.getByTestId("debt-restriction-status")).toHaveCount(0);
    await assertFundsActionBlocked(page,"button-quick-invest");
  } finally { await context.close(); }
  // A generic compliance freeze is not debt-restriction evidence; the actual
  // freeze gate stays effective on this disposable identity.
  await page.goto("about:blank");
  await db.query("UPDATE users SET account_frozen=true,freeze_reason='Synthetic unrelated review' WHERE id=$1",[identity.userId]);
  const frozen=await page.request.post("/api/investments/buy",
    {data:{accountId:identity.funded,symbol:"TEST",amount:"1.00"}});
  expect(frozen.status()).toBe(423);
  expect((await frozen.json()).message).toBe("ACCOUNT_FROZEN");
  await db.query("UPDATE users SET account_frozen=false,debt_clearance_required=false WHERE id=$1",[identity.userId]);
  await db.query(`INSERT INTO institutional_transfers(user_id,account_id,institution_name,institution_account_number,account_type,transfer_type,transfer_scope,status)
    VALUES($1,$2,'Synthetic Custodian','SYNTHETIC-ONLY','Brokerage Account','cash','full','liquidating')`,[identity.userId,identity.funded]);
  const liquidation=await page.request.post("/api/investments/buy",
    {data:{accountId:identity.funded,symbol:"TEST",amount:"1.00"}});
  expect(liquidation.status()).toBe(423);
  expect((await liquidation.json()).message).toBe("LIQUIDATION_IN_PROGRESS");
  await page.goto("/dashboard");
  await expect(page.getByTestId("text-total-balance")).toBeVisible();
  await expect(page.getByTestId("debt-restriction-status")).toHaveCount(0);
  await expect(page.getByTestId("debt-restriction-unavailable")).toHaveCount(0);
});

test("clearance after partial payment and waived fees cannot revive an old notice, including older pending credits", async ({page,identity,db}) => {
  const admin={"x-admin-key":process.env.BALANCE_E2E_ADMIN!};
  const path=`/api/admin/users/${identity.userId}/debt-restriction`;
  await db.query("UPDATE users SET debt_clearance_required=true,debt_payment_account_id=$2 WHERE id=$1",
    [identity.userId,identity.debt]);
  await login(page,identity);
  const approve=async (id:number) => {
    const response=await page.request.post(`/api/admin/transactions/${id}/approve`,{headers:admin});
    expect(response.ok(),await response.text()).toBeTruthy();
  };
  const confirm=async () => {
    const response=await page.request.post(path,
      {headers:admin,data:{confirmed:true,reason:"Synthetic explicit review of current restriction"}});
    expect(response.ok(),await response.text()).toBeTruthy();
    expect(await response.json()).toMatchObject({locked:true,debtRestrictionConfirmed:true});
  };
  const deposit=await page.request.post("/api/transactions/transfer",
    {data:{fromAccountId:-1,toAccountId:identity.debt,amount:"1250.75"}});
  expect(deposit.status()).toBe(201);
  await approve((await deposit.json()).id);
  const partial=await (await page.request.get("/api/funds-access")).json();
  expect(partial).toMatchObject({locked:true,paymentRecorded:true});
  expect(Number(partial.totalOwed)).toBe(363.64);
  await confirm();
  // This pending transaction predates the completed debt payment. A MAX(id)
  // version would miss its later approval, while full history evidence does not.
  await approve(identity.deposit);
  expect(await (await page.request.get("/api/funds-access")).json())
    .toMatchObject({locked:true,debtRestrictionConfirmed:false});
  await confirm();
  const waived=await page.request.post(`/api/admin/fees/assessments/${identity.assessment}/waive`,
    {headers:admin,data:{confirmed:true,reason:"Synthetic final fee clearance"}});
  expect(waived.ok(),await waived.text()).toBeTruthy();
  expect(await (await page.request.get("/api/funds-access")).json())
    .toMatchObject({locked:false,debtRestrictionConfirmed:false,paymentRecorded:true});
  await db.query("UPDATE accounts SET balance=-1250.75 WHERE id=$1 AND user_id=$2",[identity.debt,identity.userId]);
  expect(await (await page.request.get("/api/funds-access")).json())
    .toMatchObject({locked:true,debtRestrictionConfirmed:false,paymentRecorded:true});
  await page.reload();
  await expect(page.getByTestId("debt-restriction-status")).toHaveCount(0);
  await assertFundsActionBlocked(page,"button-quick-transfer");
  await confirm();
  await page.reload();
  await expect(page.getByTestId("debt-restriction-status")).toBeVisible();
  // Also retire a decision when cleared status is observed after an external
  // ledger correction with no new credit/fee event. Same-value debt must not
  // resurrect it even if the history fingerprint itself remains unchanged.
  await db.query("UPDATE accounts SET balance=0 WHERE id=$1 AND user_id=$2",[identity.debt,identity.userId]);
  expect(await (await page.request.get("/api/funds-access")).json()).toMatchObject({locked:false});
  await db.query("UPDATE accounts SET balance=-1250.75 WHERE id=$1 AND user_id=$2",[identity.debt,identity.userId]);
  expect(await (await page.request.get("/api/funds-access")).json())
    .toMatchObject({locked:true,debtRestrictionConfirmed:false});
  await page.reload();
  await expect(page.getByTestId("debt-restriction-status")).toHaveCount(0);
});

test("settling an unpaid fee invalidates the notice while another overdraft keeps funds locked", async ({page,identity,db}) => {
  const admin={"x-admin-key":process.env.BALANCE_E2E_ADMIN!};
  const path=`/api/admin/users/${identity.userId}/debt-restriction`;
  // Move only this disposable fixture's contract and unpaid assessment to its
  // funded account. The other account's real negative ledger remains separate.
  await db.query(`UPDATE fee_enrollments SET account_id=$1 WHERE id=(
    SELECT enrollment_id FROM fee_assessments WHERE id=$2)`,[identity.funded,identity.assessment]);
  await db.query("UPDATE fee_assessments SET account_id=$1 WHERE id=$2",[identity.funded,identity.assessment]);
  await db.query("UPDATE users SET debt_clearance_required=true,debt_payment_account_id=$2 WHERE id=$1",
    [identity.userId,identity.debt]);
  await login(page,identity);
  const confirm=async () => {
    const response=await page.request.post(path,
      {headers:admin,data:{confirmed:true,reason:"Synthetic admin reviews current remaining debt"}});
    expect(response.ok(),await response.text()).toBeTruthy();
    expect(await response.json()).toMatchObject({locked:true,debtRestrictionConfirmed:true});
  };
  await confirm();
  const enabled=await page.request.post("/api/admin/fees/settings",
    {headers:admin,data:{confirmed:true,enabled:true}});
  expect(enabled.ok(),await enabled.text()).toBeTruthy();
  const retry=await page.request.post(`/api/admin/fees/assessments/${identity.assessment}/retry`,
    {headers:admin,data:{confirmed:true,reason:"Synthetic settlement from funded account"}});
  expect(retry.ok(),await retry.text()).toBeTruthy();
  const record=(await db.query("SELECT status FROM fee_assessments WHERE id=$1",[identity.assessment])).rows[0];
  expect(record.status).toBe("paid");
  const access=await (await page.request.get("/api/funds-access")).json();
  expect(access).toMatchObject({locked:true,debtRestrictionConfirmed:false,paymentRecorded:false});
  expect(Number(access.totalOwed)).toBe(1250.75);
  const ledger=(await db.query("SELECT balance FROM accounts WHERE id=$1",[identity.debt])).rows[0];
  expect(Number(ledger.balance)).toBe(-1250.75);
  await page.reload();
  await expect(page.getByTestId("debt-restriction-status")).toHaveCount(0);
  await assertFundsActionBlocked(page,"button-quick-transfer");
  await expect(page.getByTestId(`debt-account-amount-${identity.debt}`)).toHaveText("CAD -$1,250.75");
  await expect(page.getByTestId(`debt-account-${identity.funded}`)).toHaveCount(0);
  await confirm();
  await page.reload();
  await expect(page.getByTestId("debt-restriction-status")).toBeVisible();
});
