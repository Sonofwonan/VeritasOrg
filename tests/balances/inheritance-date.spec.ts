import { test, expect, login } from "./fixtures";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { correctInheritanceDate, inheritanceProtectedSnapshot } from "../../server/fees/inheritance-date";
import { INHERITANCE, INHERITANCE_DATE_CORRECTION } from "../../server/fees/inheritance";
import { fictionalBalanceInput } from "../../server/fees/fictional-balances";
import { HistoricalBalanceService } from "../../server/historical-balances";
import { transactionDate } from "../../shared/account-display";

async function scenario(db: any, userId: number, authorizedFixture = true) {
  await db.query("UPDATE users SET display_currency='GBP' WHERE id=$1",[userId]);
  const a=(await db.query(`INSERT INTO accounts(user_id,account_type,display_name,balance,is_demo,created_at)
    VALUES($1,'Trust Account',$2,$3,true,$4) RETURNING *`,
    [userId,INHERITANCE.displayName,INHERITANCE.amount,INHERITANCE.timestamp])).rows[0];
  const t=(await db.query(`INSERT INTO transactions(to_account_id,amount,description,transaction_type,status,is_demo,created_at)
    VALUES($1,$2,$3,'transfer','completed',true,$4) RETURNING *`,
    [a.id,INHERITANCE.amount,INHERITANCE.description,INHERITANCE.timestamp])).rows[0];
  await db.query(`INSERT INTO fee_audit(actor,action,detail) VALUES('test_fixture','fictional_inheritance_account_created',$1::jsonb)`,
    [JSON.stringify({synthetic:true,userId,accountId:a.id,transactionId:t.id,
      ...INHERITANCE,authorization:"Explicit disposable fictional test scenario authorization"})]);
  const input=fictionalBalanceInput(a,[t],INHERITANCE.amount);
  if (authorizedFixture) {
    await db.query(`INSERT INTO fee_audit(actor,action,detail) VALUES('test_fixture','fictional_balance_history_authorized',$1::jsonb)`,
      [JSON.stringify({synthetic:true,userId,accountId:a.id,sourceSha256:input.source.sha256})]);
  } else {
    // Disposable imported evidence alone does not authorize fixture corrections.
    input.source.kind = "statement";
  }
  const service=new HistoricalBalanceService(db);
  const preview=await service.preview(input);
  expect(preview.canApply).toBe(true);
  const accepted=await service.apply(preview.previewId);
  return {a,t,input,service,accepted};
}
async function protectedState(db: any,userId: number) {
  const c=await db.connect();
  try { return await inheritanceProtectedSnapshot(c,userId); } finally {c.release();}
}

test("inheritance effective date changes every history surface and statement without financial writes",async ({page,db,identity})=>{
  const {a,t,input,service,accepted}=await scenario(db,identity.userId);
  await login(page,identity);
  const other=(await db.query(`SELECT id FROM accounts WHERE user_id=$1 AND account_type='Brokerage Account' LIMIT 1`,[identity.userId])).rows[0];
  const between=(await db.query(`INSERT INTO transactions(to_account_id,amount,description,transaction_type,status,is_demo,created_at)
    VALUES($1,1,'Other account activity','transfer','completed',true,'2026-10-10T16:00:00Z') RETURNING id`,[other.id])).rows[0];
  const before=await protectedState(db,identity.userId);
  expect(await correctInheritanceDate(db,identity.userId)).toMatchObject({previewOnly:true,alreadyApplied:false});
  expect((await db.query("SELECT id FROM transaction_date_corrections WHERE transaction_id=$1",[t.id])).rows).toHaveLength(0);
  const result=await correctInheritanceDate(db,identity.userId,true);
  expect(result).toMatchObject({alreadyApplied:false,effectiveDate:"2026-10-12",amount:INHERITANCE.amount});
  expect(await correctInheritanceDate(db,identity.userId,true)).toMatchObject({alreadyApplied:true});
  expect(await protectedState(db,identity.userId)).toBe(before);
  const retry=await service.preview(input);
  expect(retry.canApply).toBe(true);
  expect(await service.apply(retry.previewId)).toEqual({...accepted,applied:false});
  await expect(db.query("UPDATE transaction_date_corrections SET effective_at=now() WHERE transaction_id=$1",[t.id])).rejects.toThrow("immutable");
  await expect(db.query("DELETE FROM transaction_date_corrections WHERE transaction_id=$1",[t.id])).rejects.toThrow("immutable");
  await expect(db.query("UPDATE historical_balance_postings SET occurred_at=now() WHERE transaction_id=$1",[t.id])).rejects.toThrow("immutable");
  for(const path of ["/api/transactions",`/api/accounts/${a.id}/transactions`]){
    const rows=await (await page.request.get(path)).json();
    const deposit=rows.find((row:any)=>row.id===t.id);
    expect(deposit.createdAt).toBe(INHERITANCE_DATE_CORRECTION.timestamp);
    expect(deposit.amount).toBe(INHERITANCE.amount);
    expect(deposit.cashPostings[0].balanceAfter).toBe("1622886");
    if(path==="/api/transactions") expect(rows.findIndex((row:any)=>row.id===t.id)).toBeLessThan(rows.findIndex((row:any)=>row.id===between.id));
  }
  const date=transactionDate(INHERITANCE_DATE_CORRECTION.timestamp);
  for(const [path,id] of [["/dashboard",`txn-row-${t.id}`],[`/accounts/${a.id}`,`account-txn-row-${t.id}`],["/transactions",`transaction-row-${t.id}`]]){
    await page.goto(path);
    const row=page.getByTestId(id);
    await expect(row).toContainText(date);
    await expect(row.locator("[data-balance-after]")).toContainText("£1,622,886.00");
    await expect(row).not.toContainText(/\bCAD\b|\bGBP\b|\bdemo\b/i);
  }
  await page.goto(`/accounts/${a.id}`);
  const download=page.waitForEvent("download");
  await page.getByTestId("button-export-statement").click();
  const csv=await readFile((await (await download).path())!,"utf8");
  expect(csv).toContain(INHERITANCE_DATE_CORRECTION.timestamp);
  expect(csv).toContain(date);
  expect(csv).not.toContain("2026-10-08T16:00:00");
  expect(await protectedState(db,identity.userId)).toBe(before);
  const originals=(await db.query(`SELECT t.created_at,h.occurred_at,i.source FROM transactions t
    JOIN historical_balance_postings h ON h.transaction_id=t.id
    JOIN historical_balance_imports i ON i.id=h.import_id WHERE t.id=$1`,[t.id])).rows[0];
  expect(new Date(originals.created_at).toISOString()).toBe("2026-10-08T16:00:00.000Z");
  expect(new Date(originals.occurred_at).toISOString()).toBe("2026-10-08T16:00:00.000Z");
  expect(originals.source.sha256).toBe(input.source.sha256);
});

test("corrected inheritance ranges govern later imports and changed or unauthorized originals are refused",async ({db,identity})=>{
  const unapproved=(await db.query(`INSERT INTO users(client_ref,email,name,password)
    VALUES($1,$1||'@example.invalid','Unapproved disposable fixture','unused') RETURNING id`,[`VWUN${randomUUID().slice(0,8)}`])).rows[0];
  await scenario(db,unapproved.id,false);
  await expect(correctInheritanceDate(db,unapproved.id,true)).rejects.toThrow("Accepted");
  expect((await db.query("SELECT id FROM transaction_date_corrections WHERE user_id=$1",[unapproved.id])).rows).toHaveLength(0);
  const {a,t,service,input}=await scenario(db,identity.userId);
  const before=await protectedState(db,identity.userId);
  await correctInheritanceDate(db,identity.userId,true);
  expect(await protectedState(db,identity.userId)).toBe(before);
  const proposed=structuredClone(input);
  proposed.end="2026-10-12T16:00:00.001Z";
  proposed.movements[0].occurredAt=INHERITANCE_DATE_CORRECTION.timestamp;
  const conflict=await service.preview(proposed);
  expect(conflict.issues.some(i=>i.code==="OVERLAPPING_IMPORT")).toBe(true);
  expect(conflict.issues.some(i=>i.code==="DATE_MISMATCH")).toBe(false);
  const c=await db.connect();
  let fee:any;
  try{
    await c.query("BEGIN");
    await c.query("UPDATE accounts SET balance=balance-5 WHERE id=$1",[a.id]);
    fee=(await c.query(`INSERT INTO transactions(from_account_id,amount,description,transaction_type,status,is_demo,created_at)
      VALUES($1,5,'Later account activity','fee','completed',true,'2026-10-12T17:00:00Z') RETURNING *`,[a.id])).rows[0];
    await c.query("SELECT record_cash_posting($1,$2)",[fee.id,a.id]);
    await c.query("COMMIT");
  }finally{c.release();}
  const later={
    ...input,start:"2026-10-12T16:00:00.001Z",end:"2026-10-12T17:00:00.001Z",
    openingBalance:"1622886",closingBalance:"1622881",
    source:{...input.source,kind:"statement" as const,reference:"Disposable subsequent source",notes:"Only isolated synthetic records"},
    movements:[{sequence:1,occurredAt:"2026-10-12T17:00:00Z",delta:"-5",transactionId:fee.id,sourceReference:"later row",kind:"transaction" as const}],
  };
  const next=await service.preview(later);
  expect(next.issues).toEqual([]);
  expect(next.canApply).toBe(true);
  expect((await service.apply(next.previewId)).applied).toBe(true);
  const retryLater=await service.preview(later);
  expect(retryLater.canApply).toBe(true);
  expect((await service.apply(retryLater.previewId)).applied).toBe(false);
  const afterLater=await protectedState(db,identity.userId);
  expect((await correctInheritanceDate(db,identity.userId,true)).alreadyApplied).toBe(true);
  expect(await protectedState(db,identity.userId)).toBe(afterLater);
  expect((await db.query("SELECT id FROM transaction_date_corrections WHERE transaction_id=$1",[t.id])).rows).toHaveLength(1);
});
