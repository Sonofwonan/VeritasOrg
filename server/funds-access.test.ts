import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Pool } from "pg";
import { approvePayment, fundsAccessGuard } from "./funds-access";

const access = {locked:true,requiresPayment:true,paymentRecorded:false,totalOwed:"12398.48",paymentAccountId:25,paymentAccountName:"Brokerage Account"};
async function request(body: unknown, rows = [access], allowDeposit = false, failure = false) {
  let status=200, nextCalled=false;
  const pool = { query: async () => { if (failure) throw new Error("Unavailable"); return {rows}; } } as unknown as Pool;
  const res = { status(code: number) {status=code;return this;},json() {} };
  await fundsAccessGuard(pool,allowDeposit)({isAuthenticated:()=>true,user:{id:7},body} as any,res as any,()=>{nextCalled=true;});
  return {status,nextCalled};
}
describe("Funds access policy",()=>{
  it("rejects outgoing transactions despite any self-reported paid flag",async()=>{
    assert.deepEqual(await request({fromAccountId:26,paid:true}),{status:423,nextCalled:false});
  });
  it("accepts only a pending incoming request, not a transfer from inheritance",async()=>{
    assert.deepEqual(await request({fromAccountId:-1},[access],true),{status:200,nextCalled:true});
    assert.deepEqual(await request({fromAccountId:26},[access],true),{status:423,nextCalled:false});
  });
  it("allows access after verified payment AND clearance of actual debt",async()=>{
    assert.deepEqual(await request({},[{...access,locked:false,paymentRecorded:true,totalOwed:"0.00"}]),{status:200,nextCalled:true});
    assert.deepEqual(await request({},[{...access,paymentRecorded:true,totalOwed:"100.00"}]),{status:423,nextCalled:false});
    assert.deepEqual(await request({},[{...access,totalOwed:"0.00"}]),{status:423,nextCalled:false});
  });
  it("fails closed on missing data and database failures",async()=>{
    assert.deepEqual(await request({},[]),{status:503,nextCalled:false});
    assert.deepEqual(await request({},[access],false,true),{status:503,nextCalled:false});
  });
  it("does not impose the new policy on other clients",async()=>{
    assert.deepEqual(await request({},[{...access,locked:false,requiresPayment:false}]),{status:200,nextCalled:true});
  });
  it("credits a verified incoming payment and records it atomically, exactly once",async()=>{
    let state="pending", credits=0, receipts=0;
    const client = {release(){},async query(sql: string) {
      if(sql.startsWith("SELECT * FROM transactions")) return {rows:[{id:99,status:state,from_account_id:null,to_account_id:25,amount:"12398.48",transaction_type:"transfer"}]};
      if(sql.includes("SELECT a.user_id")) return {rows:[{user_id:7,debt_clearance_required:true,debt_payment_account_id:25}]};
      if(sql.startsWith("UPDATE accounts")) credits++;
      if(sql.startsWith("UPDATE users")) receipts++;
      if(sql.startsWith("UPDATE transactions")) state="completed";
      return {rows:[]};
    }};
    const pool = {connect:async()=>client} as unknown as Pool;
    await approvePayment(pool,99);
    await assert.rejects(()=>approvePayment(pool,99),/Only pending/);
    assert.equal(credits,1); assert.equal(receipts,1);
  });
});
