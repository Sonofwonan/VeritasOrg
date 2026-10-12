import { test, expect, login } from "./fixtures";
import { randomUUID, createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { formatBalance } from "../../shared/balance-currency";
import type { HistoryImportInput } from "../../shared/history-import";
import { fictionalBalanceInput } from "../../server/fees/fictional-balances";

const admin = () => ({ "x-admin-key": process.env.BALANCE_E2E_ADMIN! });
const date = "2024-01-02T00:00:00.000Z";

test("owner-authorized fictional history supplies muted balances without changing funds",async ({page,db,identity})=>{
  const a=(await db.query(`INSERT INTO accounts(user_id,account_type,balance,is_demo,created_at)
    VALUES($1,'Brokerage Account',-12.5,true,'2024-01-01') RETURNING *`,[identity.userId])).rows[0];
  const ids:number[]=[];
  for(const [amount,incoming,at] of [
    ["100",true,"2024-01-02"],["100",false,"2024-02-02"],["12.5",false,"2024-03-02"],
  ] as const) {
    ids.push((await db.query(`INSERT INTO transactions(from_account_id,to_account_id,amount,description,
      transaction_type,status,is_demo,created_at) VALUES($1,$2,$3,'Account activity','transfer','completed',true,$4) RETURNING id`,
    [incoming?null:a.id,incoming?a.id:null,amount,at])).rows[0].id);
  }
  await db.query("UPDATE users SET display_currency='GBP' WHERE id=$1",[identity.userId]);
  const transactions=(await db.query("SELECT * FROM transactions WHERE id=ANY($1) ORDER BY created_at,id",[ids])).rows;
  const input=fictionalBalanceInput(a,transactions,"-12.5");
  const before=await financialSnapshot(db,identity.userId);
  const unauthorized=await preview(page,input);
  expect(unauthorized.canApply).toBe(false);
  expect(unauthorized.issues.some((i:any)=>i.code==="NOT_FICTIONAL")).toBe(true);
  await db.query(`INSERT INTO fee_audit(actor,action,detail)
    VALUES('test_fixture','fictional_balance_history_authorized',$1::jsonb)`,
    [JSON.stringify({synthetic:true,userId:identity.userId,accountId:a.id,sourceSha256:input.source.sha256})]);
  const p=await preview(page,input);
  expect(p.canApply).toBe(true);
  expect((await apply(page,p.previewId)).status()).toBe(200);
  expect((await (await apply(page,p.previewId)).json()).applied).toBe(false);
  expect(await financialSnapshot(db,identity.userId)).toEqual(before);
  await login(page,identity);
  const api=await (await page.request.get(`/api/accounts/${a.id}/transactions`)).json();
  expect(api.find((t:any)=>t.id===ids[2]).cashPostings[0].balanceAfter).toBe("-12.5");
  for (const width of [320,390,768,1024,1440]) {
    await page.setViewportSize({width,height:900});
    for(const [url,testId] of [
      ["/dashboard",`txn-row-${ids[2]}`],
      [`/accounts/${a.id}`,`account-txn-row-${ids[2]}`],
      ["/transactions",`transaction-row-${ids[2]}`],
    ]) {
      await page.goto(url);
      const row=page.getByTestId(testId);
      await expect(row.locator("[data-balance-after]")).toContainText(formatBalance("-12.5","GBP"));
      await assertStack(row);
      await expect(row).not.toContainText(/\bCAD\b|\bGBP\b/);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    }
  }
});
const source = () => ({
  kind: "statement" as const, reference: "Disposable synthetic source statement",
  sha256: createHash("sha256").update("Isolated synthetic statement contents").digest("hex"),
  reviewedBy: "Isolated reviewer", notes: "Verified only against these disposable test source records",
  complete: true, attested: true, ownerAuthorized: true,
});
async function legacy(db: any, userId: number, type = "Brokerage Account") {
  const a = (await db.query(`INSERT INTO accounts(user_id,account_type,display_name,balance,created_at)
    VALUES($1,$2,$3,-0.1225,'2024-01-01') RETURNING id,account_number`, [userId,type,`Historical ${type}`])).rows[0];
  const deposit = (await db.query(`INSERT INTO transactions(to_account_id,amount,description,transaction_type,status,created_at)
    VALUES($1,5.0025,'Account deposit','transfer','completed',$2) RETURNING id`, [a.id,date])).rows[0].id;
  const fee = (await db.query(`INSERT INTO transactions(from_account_id,amount,description,transaction_type,status,created_at)
    VALUES($1,20.25,'Monthly service fee','fee','completed',$2) RETURNING id`, [a.id,date])).rows[0].id;
  const input: HistoryImportInput = { userId,accountId: a.id,start: "2024-01-01T00:00:00Z",end: "2024-02-01T00:00:00Z",
    openingBalance: "15.125",closingBalance: "-0.1225",source: source(),nonPostingTransactions: [],
    movements: [
      { sequence: 1,occurredAt: date,delta: "5.0025",transactionId: deposit,sourceReference: "statement line 1",kind: "transaction" },
      { sequence: 2,occurredAt: date,delta: "-20.25",transactionId: fee,sourceReference: "statement line 2",kind: "transaction" },
    ] };
  return { accountId: a.id,number: a.account_number,deposit,fee,input };
}
async function financialSnapshot(db: any, userId: number) {
  const result: Record<string, unknown> = {};
  for (const [key,query] of [
    ["accounts","SELECT * FROM accounts WHERE user_id=$1 ORDER BY id"],
    ["transactions","SELECT * FROM transactions WHERE from_account_id IN(SELECT id FROM accounts WHERE user_id=$1) OR to_account_id IN(SELECT id FROM accounts WHERE user_id=$1) ORDER BY id"],
    ["holdings","SELECT * FROM investments WHERE account_id IN(SELECT id FROM accounts WHERE user_id=$1) ORDER BY id"],
    ["fees","SELECT * FROM fee_enrollments WHERE user_id=$1 ORDER BY id"],
    ["assessments","SELECT * FROM fee_assessments WHERE account_id IN(SELECT id FROM accounts WHERE user_id=$1) ORDER BY id"],
    ["user","SELECT * FROM users WHERE id=$1"],
    ["cash","SELECT * FROM account_cash_changes WHERE account_id IN(SELECT id FROM accounts WHERE user_id=$1) ORDER BY id"],
    ["management","SELECT * FROM management_contracts WHERE user_id=$1 ORDER BY id"],
    ["settings","SELECT * FROM fee_settings WHERE $1>0"],
  ]) result[key] = (await db.query(query,[userId])).rows;
  return result;
}
async function preview(page: any, input: HistoryImportInput) {
  const response = await page.request.post("/api/admin/history/preview",{ headers: admin(),data: input });
  expect(response.status()).toBe(200);
  return response.json();
}
async function apply(page: any, previewId: string) {
  return page.request.post("/api/admin/history/apply",{ headers: admin(),data: { previewId,confirm: true } });
}
async function assertStack(row: any) {
  const balances = row.locator("[data-balance-after]");
  await expect(balances.first()).toBeAttached();
  const count = await balances.count();
  expect(count).toBeGreaterThan(0);
  // Use the balance component's immediate preceding amount rather than description text.
  const geometry = await balances.first().evaluate((p: HTMLElement) => {
    const amount = p.previousElementSibling as HTMLElement;
    const a = amount.getBoundingClientRect(), b = p.getBoundingClientRect(), r = p.closest("[data-testid]")!.getBoundingClientRect();
    return { amountBottom: a.bottom, balanceTop: b.top, amountRight: a.right, balanceRight: b.right,
      amountWidth: a.width, amountClient: amount.clientWidth, amountScroll: amount.scrollWidth,
      rowRight: r.right, amountLeft: a.left,
      balanceSize: parseFloat(getComputedStyle(p).fontSize), amountSize: parseFloat(getComputedStyle(amount).fontSize) };
  });
  expect(geometry.balanceTop).toBeGreaterThanOrEqual(geometry.amountBottom);
  expect(Math.abs(geometry.amountRight - geometry.balanceRight)).toBeLessThanOrEqual(1);
  expect(geometry.amountSize).toBeGreaterThan(geometry.balanceSize);
  expect(geometry.amountScroll).toBeLessThanOrEqual(geometry.amountClient + 1);
  expect(geometry.amountRight).toBeLessThanOrEqual(geometry.rowRight + 1);
  expect(geometry.amountLeft).toBeGreaterThanOrEqual(0);
}

for (const currency of ["CAD","GBP"] as const) {
  test(`older source balances and stacked rows for every account type in ${currency}`, async ({ page,identity,db }) => {
    test.setTimeout(180000);
    await db.query("UPDATE users SET display_currency=$2 WHERE id=$1",[identity.userId,currency]);
    await login(page,identity);
    const types = ["Brokerage Account","Traditional IRA","Roth IRA","401(k) / 403(b)","529 Savings Plan","Trust Account"];
    const records = [];
    for (const type of types) records.push(await legacy(db,identity.userId,type));
    const before = await financialSnapshot(db,identity.userId);
    for (const record of records) {
      const old = await (await page.request.get(`/api/accounts/${record.accountId}/transactions`)).json();
      expect(old.every((t: any) => t.cashPostings.length === 0)).toBe(true);
      const p = await preview(page,record.input);
      expect(p).toMatchObject({ canApply: true,calculatedClosing: "-0.1225",issues: [] });
      expect(p.rows.map((r: any) => r.balanceAfter)).toEqual(["20.1275","-0.1225"]);
      const accepted = await apply(page,p.previewId);
      expect(accepted.status()).toBe(200);
      const result = await accepted.json();
      expect(result).toMatchObject({ applied: true,postingCount: 2 });
      expect(await (await apply(page,p.previewId)).json()).toEqual({ ...result,applied: false });
      const secondPreview = await preview(page,record.input);
      expect(secondPreview.canApply).toBe(true);
      expect(await (await apply(page,secondPreview.previewId)).json()).toEqual({ ...result,applied: false });
      const audit = await (await page.request.get(`/api/admin/history/imports?accountId=${record.accountId}`,{ headers: admin() })).json();
      expect(audit).toHaveLength(1);
      expect(audit[0].source.sha256).toBe(record.input.source.sha256);
      await expect(db.query("UPDATE historical_balance_postings SET balance_after=999 WHERE account_id=$1",[record.accountId])).rejects.toThrow("immutable");
      const history = await (await page.request.get(`/api/accounts/${record.accountId}/transactions`)).json();
      expect(history.find((t: any) => t.id === record.fee).cashPostings[0]).toMatchObject({ accountId: record.accountId,balanceAfter: "-0.1225" });
      await page.goto(`/accounts/${record.accountId}`);
      await expect(page.getByTestId("text-account-cash-balance")).toHaveText(formatBalance("-0.1225",currency));
      const row = page.getByTestId(`account-txn-row-${record.fee}`);
      await expect(row).toContainText(formatBalance("-0.1225",currency));
      await assertStack(row);
      if (currency === "GBP") await expect(row).not.toContainText(/\bCAD\b|\bGBP\b/);
    }
    const first = records[0];
    for (const width of [320,390,768,1024,1440]) {
      await page.setViewportSize({ width,height: 900 });
      await page.goto("/dashboard");
      await assertStack(page.getByTestId(`txn-row-${first.fee}`));
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.goto(`/accounts/${first.accountId}`);
      await assertStack(page.getByTestId(`account-txn-row-${first.fee}`));
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    const downloadPromise = page.waitForEvent("download");
    await page.getByTestId("button-export-statement").click();
    const csv = await readFile((await (await downloadPromise).path())!,"utf8");
    expect(csv).toContain('"-20.25","-0.1225"');
    await page.goto("/transactions");
    await page.getByTestId("transactions-account-filter").selectOption(String(first.accountId));
    const fullRow = page.getByTestId(`transaction-row-${first.fee}`);
    await expect(fullRow).toContainText(formatBalance("-0.1225",currency));
    await assertStack(fullRow);
    expect(await financialSnapshot(db,identity.userId)).toEqual(before);
  });
}

test("historical imports block unauthorized, incomplete, stale, conflicting and ambiguous evidence", async ({ page,identity,db }) => {
  const record = await legacy(db,identity.userId);
  const before = await financialSnapshot(db,identity.userId);
  const noAuth = await page.request.post("/api/admin/history/preview",{ data: record.input });
  expect(noAuth.status()).toBe(401);
  expect((await page.request.post("/api/admin/history/apply",{ data: { previewId: randomUUID(),confirm: true } })).status()).toBe(401);
  expect((await page.request.get(`/api/admin/history/imports?accountId=${record.accountId}`)).status()).toBe(401);
  const wrongOwner = { ...record.input,userId: 2147483647 };
  expect((await page.request.post("/api/admin/history/preview",{ headers: admin(),data: wrongOwner })).status()).toBe(404);
  const noSource = structuredClone(record.input); noSource.source.attested = false;
  const p = await preview(page,noSource);
  expect(p.canApply).toBe(false);
  expect((await apply(page,p.previewId)).status()).toBe(409);
  const badClosing = await preview(page,{ ...record.input,closingBalance: "100" });
  expect(badClosing.canApply).toBe(false);
  expect(badClosing.issues.some((i: any) => i.code === "CLOSING_MISMATCH")).toBe(true);
  const fake = (await db.query(`INSERT INTO transactions(from_account_id,amount,description,transaction_type,status,created_at)
    VALUES($1,123,'Synthetic generated row that never moved cash','fee','completed',$2) RETURNING id`,[record.accountId,date])).rows[0].id;
  const gaps = await preview(page,record.input);
  expect(gaps.canApply).toBe(false);
  expect(gaps.issues.some((i: any) => i.transactionId === fake)).toBe(true);
  record.input.nonPostingTransactions.push({ transactionId: fake,reason: "Statement independently proves this generated row never moved cash",sourceReference: "non-posting reconciliation" });
  const safe = await preview(page,record.input);
  expect(safe.canApply).toBe(true);
  // A subsequent legitimate history change invalidates the saved preview.
  const later = (await db.query(`INSERT INTO transactions(to_account_id,amount,description,transaction_type,status,created_at)
    VALUES($1,1,'Synthetic new source movement','transfer','completed','2024-01-04') RETURNING id`,[record.accountId])).rows[0].id;
  expect((await apply(page,safe.previewId)).status()).toBe(409);
  expect((await db.query("SELECT id FROM historical_balance_imports WHERE account_id=$1",[record.accountId])).rows).toHaveLength(0);
  record.input.movements.push({ sequence: 3,occurredAt: "2024-01-04T00:00:00Z",delta: "1",transactionId: later,sourceReference: "source line 3",kind: "transaction" });
  record.input.closingBalance = "0.8775";
  const reviewed = await preview(page,record.input);
  expect(reviewed.canApply).toBe(true);
  const expiredId = randomUUID();
  await db.query(`INSERT INTO historical_balance_previews(id,account_id,input,fingerprint,snapshot_hash,result,created_at)
    SELECT $1,account_id,input,fingerprint,snapshot_hash,result,clock_timestamp()-interval '31 minutes'
    FROM historical_balance_previews WHERE id=$2`,[expiredId,reviewed.previewId]);
  expect((await apply(page,expiredId)).status()).toBe(409);
  expect((await apply(page,reviewed.previewId)).status()).toBe(200);
  const conflict = await preview(page,{ ...record.input,source: { ...record.input.source,notes: "Attempted conflicting replacement for a reviewed period" } });
  expect(conflict.canApply).toBe(false);
  expect(conflict.issues.some((i: any) => i.code === "OVERLAPPING_IMPORT")).toBe(true);
  expect((await apply(page,conflict.previewId)).status()).toBe(409);
  const after = await financialSnapshot(db,identity.userId);
  for (const key of ["accounts","holdings","fees","assessments","user","cash","management","settings"]) expect(after[key]).toEqual(before[key]);
});

test("both historical transfer sides stay account-specific and private, and conflicting live evidence blocks import", async ({ page,identity,db }) => {
  const date = "2024-03-02T00:00:00.000Z";
  const first = (await db.query(`INSERT INTO accounts(user_id,account_type,balance,created_at)
    VALUES($1,'Brokerage Account',90,'2024-01-01') RETURNING id`,[identity.userId])).rows[0].id;
  const second = (await db.query(`INSERT INTO accounts(user_id,account_type,balance,created_at)
    VALUES($1,'Trust Account',30,'2024-01-01') RETURNING id`,[identity.userId])).rows[0].id;
  const id = (await db.query(`INSERT INTO transactions(from_account_id,to_account_id,amount,description,transaction_type,status,created_at)
    VALUES($1,$2,10,'Account transfer','transfer','completed',$3) RETURNING id`,[first,second,date])).rows[0].id;
  const make = (accountId: number,opening: string,closing: string,delta: string): HistoryImportInput => ({
    userId: identity.userId,accountId,start: "2024-03-01T00:00:00Z",end: "2024-04-01T00:00:00Z",
    openingBalance: opening,closingBalance: closing,source: source(),nonPostingTransactions: [],
    movements: [{ sequence: 1,occurredAt: date,delta,transactionId: id,sourceReference: "transfer line",kind: "transaction" }],
  });
  await login(page,identity);
  for (const input of [make(first,"100","90","-10"),make(second,"20","30","10")]) {
    const p = await preview(page,input);
    expect(p.canApply).toBe(true);
    expect((await apply(page,p.previewId)).status()).toBe(200);
  }
  const portfolio = await (await page.request.get("/api/transactions")).json();
  expect(portfolio.find((t: any) => t.id === id).cashPostings.map((p: any) => p.balanceAfter)).toEqual(["90","30"]);
  const single = await (await page.request.get(`/api/accounts/${first}/transactions`)).json();
  expect(single[0].cashPostings).toHaveLength(1);
  expect(single[0].cashPostings[0].accountId).toBe(first);
  await page.goto("/dashboard");
  const row = page.getByTestId(`txn-row-${id}`);
  await expect(row.locator("[data-balance-after]")).toHaveCount(2);
  await expect(row.locator("[data-balance-after]").first()).toContainText("Brokerage Account");
  await expect(row.locator("[data-balance-after]").last()).toContainText("Trust Account");
  await page.goto("/transactions");
  await page.getByTestId("transactions-account-filter").selectOption(String(second));
  const filtered = page.getByTestId(`transaction-row-${id}`);
  await expect(filtered.locator("[data-balance-after]")).toHaveCount(1);
  await expect(filtered.locator("[data-balance-after]")).toContainText("CAD $30.00");
  // A different owner's account can never leak its resulting balance.
  const unrelatedOwner = (await db.query(`INSERT INTO users(email,name,password) VALUES($1,'Isolated unrelated owner','unused')
    RETURNING id`,[`unrelated-${randomUUID()}@example.test`])).rows[0].id;
  const other = (await db.query(`INSERT INTO accounts(user_id,account_type,balance,created_at)
    VALUES($1,'Trust Account',30,'2024-01-01') RETURNING id`,[unrelatedOwner])).rows[0].id;
  const cross = (await db.query(`INSERT INTO transactions(from_account_id,to_account_id,amount,transaction_type,status,created_at)
    VALUES($1,$2,10,'transfer','completed',$3) RETURNING id`,[first,other,date])).rows[0].id;
  const input = make(other,"20","30","10");
  input.userId = unrelatedOwner; input.movements[0].transactionId = cross;
  const p = await preview(page,input);
  expect(p.canApply).toBe(true);
  expect((await apply(page,p.previewId)).status()).toBe(200);
  const crossHistory = await (await page.request.get("/api/transactions")).json();
  expect(crossHistory.find((t: any) => t.id === cross).cashPostings).toEqual([]);
  expect((await page.request.get(`/api/accounts/${other}/transactions`)).status()).toBe(403);
  // New actual postings override historical evidence, and mismatched imports fail.
  const c = await db.connect();
  let liveId: number;
  try {
    await c.query("BEGIN");
    await c.query("UPDATE accounts SET balance=balance+1 WHERE id=$1",[second]);
    liveId = (await c.query(`INSERT INTO transactions(to_account_id,amount,transaction_type,status,created_at)
      VALUES($1,1,'transfer','completed','2024-04-02') RETURNING id`,[second])).rows[0].id;
    await c.query("SELECT record_cash_posting($1,$2)",[liveId,second]);
    await c.query("COMMIT");
  } finally { c.release(); }
  const mismatch = make(second,"500","501","1");
  mismatch.start = "2024-04-01T00:00:00Z"; mismatch.end = "2024-05-01T00:00:00Z";
  mismatch.movements[0] = { ...mismatch.movements[0],transactionId: liveId!,occurredAt: "2024-04-02T00:00:00Z" };
  const blocked = await preview(page,mismatch);
  expect(blocked.canApply).toBe(false);
  expect(blocked.issues.some((i: any) => i.code === "LIVE_EVIDENCE_CONFLICT")).toBe(true);
});

test("staff can preview, export gaps, confirm and audit a historical import from the normal admin screen", async ({ page,identity,db }) => {
  const record = await legacy(db,identity.userId,"Trust Account");
  await page.goto("/admin");
  await page.getByTestId("input-admin-password").fill(process.env.BALANCE_E2E_ADMIN!);
  await page.getByTestId("button-admin-login").click();
  await page.getByRole("tab",{ name: "Historical Balances",exact: true }).click();
  const panel = page.getByRole("tabpanel");
  await panel.getByLabel("Client",{ exact: true }).selectOption(String(identity.userId));
  await panel.getByLabel("Account",{ exact: true }).selectOption(String(record.accountId));
  await panel.getByLabel("Reviewed movement input").fill(JSON.stringify(record.input));
  await panel.getByRole("button",{ name: "Preview history",exact: true }).click();
  await expect(panel).toContainText("SOURCE_NOT_REVIEWED");
  await expect(panel.getByRole("button",{ name: "Apply historical balances",exact: true })).toBeDisabled();
  const reportPromise = page.waitForEvent("download");
  await panel.getByRole("button",{ name: "Export gap report",exact: true }).click();
  const report = JSON.parse(await readFile((await (await reportPromise).path())!,"utf8"));
  expect(report.account.accountNumber).toBe(record.number);
  expect(report.issues.length).toBeGreaterThan(0);
  await panel.getByRole("checkbox",{ name: "I reviewed the source and confirm the records include every movement in the selected period." }).check();
  await panel.getByRole("checkbox",{ name: "I attest that the source details and movement data are accurate." }).check();
  await panel.getByRole("checkbox",{ name: "I have the account owner's authorization to import this history evidence." }).check();
  await panel.getByRole("button",{ name: "Preview history",exact: true }).click();
  await expect(panel).toContainText("No issues reported by the preview.");
  await panel.getByRole("checkbox",{ name: "I reviewed the preview and authorize applying this source-backed historical balance import." }).check();
  await panel.getByRole("button",{ name: "Apply historical balances",exact: true }).click();
  await expect(panel).toContainText("2 posting records");
  await expect(panel).toContainText(record.input.source.reference);
  await page.screenshot({ path: test.info().outputPath("staff-history-workflow.png"),fullPage: true });
});
