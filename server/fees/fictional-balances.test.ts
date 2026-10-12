import { test } from "node:test";
import assert from "node:assert/strict";
import { fictionalBalanceInput, type FictionalTransaction } from "./fictional-balances";
import { reconcileHistoricalBalances, type HistorySnapshot } from "../historical-balances-reconcile";

const account = { id: 10,user_id: 1,is_demo: true,balance: "-12.5",created_at: "2024-01-01T00:00:00Z" };
const transactions: FictionalTransaction[] = [
  {id: 20,from_account_id:null,to_account_id:10,amount:"100",status:"completed",is_demo:true,cash_debit_deferred:false,created_at:"2024-01-02T00:00:00Z"},
  {id: 21,from_account_id:10,to_account_id:null,amount:"100",status:"completed",is_demo:true,cash_debit_deferred:false,created_at:"2024-02-02T00:00:00Z"},
  {id: 22,from_account_id:10,to_account_id:null,amount:"12.5",status:"completed",is_demo:true,cash_debit_deferred:false,created_at:"2024-03-02T00:00:00Z"},
];
function snapshot(): HistorySnapshot {
  return {account:{...account,fictional_history_authorized:true,account_number:"VW-ISOLATED",account_type:"Brokerage Account",display_name:null},
    transactions: transactions.map(t=>({...t,created_at:String(t.created_at)})),live:[],historical:[],previous:[]};
}
test("fictional history runs forward from declared zero and retains synthetic provenance",()=>{
  const before = JSON.stringify({account,transactions});
  const input=fictionalBalanceInput(account,[...transactions].reverse(),"-12.5");
  assert.equal(input.source.kind,"synthetic_fixture");
  const result=reconcileHistoricalBalances(input,snapshot(),"synthetic");
  assert.deepEqual(result.rows.map(r=>r.balanceAfter),["100","0","-12.5"]);
  assert.equal(result.canApply,true);
  assert.equal(JSON.stringify({account,transactions}),before);
  assert.deepEqual(fictionalBalanceInput(account,transactions,"-12.5"),input);
});
test("never balances an incomplete scenario by inventing an opening or adjustment",()=>{
  assert.throws(()=>fictionalBalanceInput(account,transactions.slice(1),"-12.5"),/do not reconcile/);
  assert.throws(()=>fictionalBalanceInput({...account,balance:"0"},transactions,"-12.5"),/do not reconcile/);
  assert.throws(()=>fictionalBalanceInput({...account,is_demo:false},transactions,"-12.5"),/fictional/);
  assert.throws(()=>fictionalBalanceInput(account,transactions.map(t=>({...t,is_demo:false})),"-12.5"),/non-fictional/);
  assert.throws(()=>fictionalBalanceInput(account,transactions.map(t=>({...t,status:"pending"})),"-12.5"),/Ambiguous/);
});
test("service rejects synthetic evidence for real records and changed balances",()=>{
  const input=fictionalBalanceInput(account,transactions,"-12.5");
  for (const change of [
    (s:HistorySnapshot)=>{s.account.is_demo=false;},
    (s:HistorySnapshot)=>{s.account.fictional_history_authorized=false;},
    (s:HistorySnapshot)=>{s.transactions[0].is_demo=false;},
    (s:HistorySnapshot)=>{s.account.balance="2";},
  ]) {
    const s=snapshot();change(s);
    assert.equal(reconcileHistoricalBalances(input,s,"synthetic").canApply,false);
  }
});
