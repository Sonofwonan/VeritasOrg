import assert from "node:assert/strict";
import { describe, it } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Router } from "wouter";
import { ClientFees as ClientFeesComponent } from "../../client/src/components/fees/client-fees";
import { AdminFees } from "../../client/src/components/fees/admin-fees";
import { FeeLiability, AccountFeeBalance } from "../../client/src/components/fees/fee-liability";
import { DebtAccountSummary } from "../../client/src/components/fees/debt-account-summary";
import { DebtRestrictionStatus } from "../../client/src/components/fees/debt-restriction-status";
import { fundsActionFeedback } from "../../shared/funds-access";
import DashboardPage from "../../client/src/pages/dashboard";
import AccountsPage from "../../client/src/pages/accounts-page";
import { accountStatementCsv } from "../../client/src/lib/account-statement";
import { balanceCurrencyLabel, clientBalanceCurrency, formatBalance, transactionDescription } from "../../shared/balance-currency";
import { transactionDate } from "../../shared/account-display";
import { DEFAULT_FEE_COMPONENTS, DEFAULT_FEE_TERMS, MANAGEMENT_TERMS, type ClientFees, type ClientFeeSummary, type FeeOverview, type FeePreview } from "../../shared/fees";

const settings = { enabled: false, timeZone: "America/Toronto" };
const schedule = {
  id: 1, version: 1, name: "Fixture service plan", currency: "CAD" as const,
  total: "363.64", components: DEFAULT_FEE_COMPONENTS, terms: DEFAULT_FEE_TERMS, createdAt: "2030-01-01T12:00:00Z",
};
it("explains existing locks without inventing debt, payment or admin confirmation", () => {
  const access = { locked:true, requiresPayment:true, paymentRecorded:false,
    totalOwed:"50.00", paymentAccountId:901, paymentAccountName:"Synthetic Brokerage" };
  const before = structuredClone(access);
  for (const confirmed of [undefined, false, true]) {
    assert.equal(fundsActionFeedback(true, {...access,debtRestrictionConfirmed:confirmed})?.message,
      "Transfers and investing are blocked until your account debt is cleared. Please contact your advisor to arrange payment.");
  }
  assert.equal(fundsActionFeedback(false, access),null);
  assert.equal(fundsActionFeedback(true,{...access,totalOwed:"0.00"})?.title,"Payment confirmation needed");
  assert.equal(fundsActionFeedback(true,access,true)?.retry,true);
  assert(!fundsActionFeedback(true,access,true)?.message.includes("debt"));
  assert.equal(fundsActionFeedback(true)?.title,"Checking access");
  assert.equal(fundsActionFeedback(true,{...access,requiresPayment:false})?.title,"Access restricted");
  for (const amount of ["NaN","Infinity","","-1"]) {
    assert.equal(fundsActionFeedback(true,{...access,totalOwed:amount})?.retry,true);
  }
  assert.deepEqual(access,before);
});

it("separates confirmed debt restrictions from debt, failed evidence, generic freezes and liquidation", () => {
  const access = { locked:true, requiresPayment:true, paymentRecorded:false,
    totalOwed:"50.00", paymentAccountId:901, paymentAccountName:"Synthetic Brokerage" };
  for (const props of [
    {requiresPayment:false},
    {requiresPayment:true, data:{...access,locked:false,debtRestrictionConfirmed:true}},
    {requiresPayment:true,data:access},
    {requiresPayment:true,data:{...access,debtRestrictionConfirmed:false}},
  ]) assert.equal(render(DebtRestrictionStatus,props,[]),"");
  for (const props of [
    {requiresPayment:true},
    {requiresPayment:true,error:true,data:{...access,debtRestrictionConfirmed:true}},
  ]) {
    const html=render(DebtRestrictionStatus,props,[]);
    assert(html.includes("Checking access") || html.includes("Please retry"));
    assert(!html.includes("Your administrator"));
  }
  const confirmed=render(DebtRestrictionStatus,{requiresPayment:true,
    data:{...access,debtRestrictionConfirmed:true}},[]);
  assert(confirmed.includes("Transfers and investing are on hold. Please contact your advisor"));
  assert(!confirmed.includes("sign in") && !confirmed.includes("50.00"));
  for (const condition of ["no restriction","generic freeze","liquidation","failed access"]) {
    const data=dashboardData([{id:901,accountType:"Brokerage Account",balance:"-50.00"}]);
    data.find(item=>item.key[0]==="/api/user")!.value = {
      id:7,name:"Synthetic Restriction Client",accountFrozen:condition==="generic freeze",
      debtClearanceRequired:condition==="failed access",
    };
    if(condition==="liquidation") data.find(item=>item.key[0]==="/api/institutional-transfers")!.value=[
      {id:902,status:"liquidating",institutionName:"Synthetic Custodian",transferType:"cash"}];
    const html=render(DashboardPage,{},data,condition==="failed access"?[["/api/funds-access",7]]:[]);
    assert(!html.includes("Your administrator has restricted"),condition);
    assert.equal(displayedValue(html,"debt-account-amount-901"),"CAD -$50.00");
    assert(!html.includes('data-testid="button-quick-wire"'));
    if(condition==="failed access") for(const action of ["transfer","invest"]) {
      assert(html.match(new RegExp(`<button[^>]*data-testid="button-quick-${action}"[^>]*>`))?.[0].includes("data-funds-action"));
    }
  }
});
it("renders only exact named debt amounts and preserves privacy, unavailable and zero states", () => {
  const summary:ClientFeeSummary={totalUnpaid:"25.00",totalOverdraft:"100.00",totalOwed:"125.00",
    accounts:[{accountId:901,accountName:"Account #901",unpaidTotal:"25.00",unpaidCount:1,overdraft:"100.00"}]};
  const props={summary,accounts:[{id:901,accountType:"Brokerage Account",displayName:"Synthetic Discretionary Investment Account"}],currency:"GBP"};
  const before=JSON.stringify(props);
  const html=render(DebtAccountSummary,props,[]);
  assert.equal(displayedValue(html,"debt-account-amount-901"),"-£125.00");
  assert.equal(html.match(/£125\.00/g)?.length,1);
  assert(html.includes("Synthetic Discretionary Investment Account") && !html.includes('/accounts/901'));
  assert(html.includes("text-red-700") && !html.includes("Amount owed"));
  for(const forbidden of ["Account #","CAD","GBP","notice","negative cash ledger","interest","minimum payment","due date","credit limit"])
    assert(!html.includes(forbidden),forbidden);
  assert(!render(DebtAccountSummary,{...props,hidden:true},[]).includes("125.00"));
  assert(render(DebtAccountSummary,{loading:true},[]).includes("Loading account balances"));
  assert(render(DebtAccountSummary,{error:true},[]).includes("unavailable"));
  assert(render(DebtAccountSummary,{summary:{...summary,accounts:[]}},[]).includes("Account details unavailable"));
  assert(render(DebtAccountSummary,{summary:{...summary,accounts:[{...summary.accounts[0],overdraft:"NaN"}]}},[]).includes("Unavailable"));
  assert.equal(render(DebtAccountSummary,{summary:{totalUnpaid:"0",totalOverdraft:"0",accounts:[]}},[]),"");
  assert.equal(JSON.stringify(props),before);
});
it("uses signed red dashboard balances and positive black Amount owed with distinct captions",()=>{
  const summary:ClientFeeSummary={totalUnpaid:"25",totalOverdraft:"100",totalOwed:"125",
    accounts:[{accountId:901,accountName:"Brokerage Account",unpaidTotal:"25",unpaidCount:1,overdraft:"100"}]};
  const accounts=[{id:901,accountType:"Brokerage Account",accountNumber:"VW-SYNTHETIC-1234",balance:"-100"}];
  for(const variant of ["dashboard","accounts"] as const){
    const html=render(DebtAccountSummary,{summary,accounts,variant,currency:"GBP"},[]);
    assert.equal(displayedValue(html,"debt-account-amount-901"),variant==="dashboard"?"-£125.00":"£125.00");
    assert(html.includes(variant==="dashboard"?"text-red-700":"text-black dark:text-foreground"));
    assert.equal(html.includes("Amount owed"),variant==="accounts");
    assert.equal(html.includes('class="sr-only"'),variant==="accounts");
    assert(!html.includes("Account details") && !html.includes("/accounts/901"));
    assert(!html.includes("1234"),"Single-account summary needs no extra number caption");
  }
});
it("includes posted overdraft in unpaid-fees KPI exactly once without changing funded totals",()=>{
  for(const currency of ["GBP","CAD"] as const) for(const unpaid of ["0.00","25.00"]){
    const data=dashboardData([
      {id:901,accountType:"Brokerage Account",balance:"-100"},
      {id:902,accountType:"Trust Account",balance:"1622886"},
    ],[],unpaid);
    data.find(item=>item.key[0]==="/api/user")!.value={id:7,name:"Synthetic client",displayCurrency:currency};
    const before=JSON.stringify(data);
    const html=render(DashboardPage,{},data);
    assert.equal(displayedValue(html,"text-overdraft"),formatBalance("-100",currency));
    assert.equal(displayedValue(html,"text-unpaid-fees"),formatBalance(String(-100-Number(unpaid)),currency));
    assert.equal(displayedValue(html,"text-total-balance"),formatBalance("1622886",currency));
    assert(!html.includes("Negative cash balances") && !html.includes("Outstanding assessments"));
    assert.equal(JSON.stringify(data),before);
  }
});
it("rejects malformed or inconsistent owed totals and leaves genuine zero unsigned",()=>{
  const data=dashboardData([{id:901,accountType:"Brokerage Account",balance:"-100"}],[],"25");
  const entry=data.find(item=>item.key[0]==="/api/fees")!;
  const original=entry.value as ClientFeeSummary;
  for(const invalid of [
    {totalUnpaid:"NaN"},{totalUnpaid:""},{totalOverdraft:"-1"},{totalOverdraft:"Infinity"},
    {totalOwed:""},{totalOwed:"-12"},{totalOwed:"0"},
  ]){
    entry.value={...original,...invalid};
    assert.equal(displayedValue(render(DashboardPage,{},data),"text-unpaid-fees"),"Unavailable",JSON.stringify(invalid));
  }
  entry.value={totalUnpaid:"25",accounts:original.accounts};
  assert.equal(displayedValue(render(DashboardPage,{},data),"text-unpaid-fees"),"CAD -$125.00");
  for(const currency of ["GBP","CAD"] as const){
    const zero=dashboardData([{id:901,accountType:"Brokerage Account",balance:"100"}]);
    zero.find(item=>item.key[0]==="/api/user")!.value={id:7,name:"Synthetic client",displayCurrency:currency};
    const html=render(DashboardPage,{},zero);
    for(const id of ["text-overdraft","text-unpaid-fees"]) assert.equal(displayedValue(html,id),formatBalance("0",currency));
    assert(!html.includes('data-testid="debt-account-summary"'));
  }
});
it("presents generated fees plainly without altering stored descriptions or monetary amounts", () => {
  const description = "CAD monthly service fee · 2026-09-01 · Assessment 65 · Authorized fee overdraft";
  assert.equal(transactionDescription(description, "GBP", "fee"), "Monthly service fee");
  assert.equal(transactionDescription("£ monthly service fee", "GBP"), "Monthly service fee");
  assert.equal(transactionDescription("GBP annual management fee", "GBP"), "Annual management fee");
  assert.equal(transactionDescription("£363.64 fee payment", "GBP"), "£363.64 fee payment");
  assert.equal(transactionDescription("CAD 363.64 fee payment", "GBP"), "£ 363.64 fee payment");
  assert.equal(transactionDescription(description, "CAD", "fee"), "Monthly service fee");
  assert.equal(transactionDescription(description, "CAD", "transfer"), description);
  assert.equal(transactionDescription("Inheritance — family farm sale proceeds", "GBP"), "Inheritance — family farm sale proceeds");
  const transaction = {id:65,toAccountId:null,amount:"363.64",description,transactionType:"fee",status:"completed",createdAt:"2026-09-01T14:00:00Z"};
  const csv = accountStatementCsv(25,"VW-TEST-0025",[transaction],"GBP");
  assert(csv.includes('"Monthly service fee"'));
  assert(csv.includes('"September 1, 2026"'));
  assert(!csv.includes("Assessment") && !csv.includes("Authorized fee overdraft"));
  assert(!csv.includes("£ monthly"));
  assert(csv.includes('"-363.64"'));
  assert.equal(transaction.description, description);
  const data=dashboardData([{id:25,accountType:"Brokerage Account",balance:"-12398.48"}]);
  data.find(item=>item.key[0]==="/api/user")!.value={id:7,displayCurrency:"GBP"};
  data.find(item=>item.key[0]==="/api/transactions")!.value=[transaction];
  const html=render(DashboardPage,{},data);
  assert(html.includes("Monthly service fee"));
  assert(!html.includes("Assessment 65") && !html.includes("Authorized fee overdraft"));
  assert(!html.includes("£ monthly service fee"));
  assert(html.includes("£363.64"));
});
it("cleans only generated fee metadata and preserves refunds, unrelated references and CSV safety", () => {
  for (const currency of ["CAD", "GBP"] as const) {
    for (const funding of ["Authorized fee overdraft", "Available cash"]) {
      assert.equal(transactionDescription(`CAD monthly service fee · 2026-05-01 · Assessment 61 · ${funding}`, currency, "fee"), "Monthly service fee");
      assert.equal(transactionDescription(`CAD annual discretionary-management fee · 2026-05-01 · Assessment 62 · ${funding}`, currency, "fee"), "Annual management fee");
    }
    assert.equal(transactionDescription("CAD monthly service fee refund · Assessment 61", currency, "fee_refund"), "Monthly service fee refund");
    assert.equal(transactionDescription("CAD annual management fee refund · Assessment 62", currency, "fee_refund"), "Annual management fee refund");
    for (const text of [
      "Inheritance — family farm sale proceeds",
      "Farm sale invoice 61 · 2026-05-01",
      "Monthly service fee · Customer reference 61",
      "Monthly service fee · 2026-05-01 · Assessment 61 · customer note",
      "Transfer 363.64 for Assessment 61",
      "=1+61",
    ]) assert.equal(transactionDescription(text, currency, "fee"), text);
    assert.equal(transactionDescription(null, currency, "fee"), "");
    const rows = [{id:61,toAccountId:null,amount:"363.64",description:"CAD monthly service fee refund · Assessment 61",transactionType:"fee_refund",status:"completed",createdAt:"2026-05-01T14:00:00Z"}];
    const before = JSON.stringify(rows);
    const csv = accountStatementCsv(900, "VW-TEST-0900", rows, currency);
    assert(csv.includes('"Monthly service fee refund"'));
    assert(csv.includes('"61","VW-TEST-0900","2026-05-01T14:00:00.000Z"'));
    assert(csv.includes('"-363.64"') && csv.includes('"May 1, 2026"'));
    assert.equal(JSON.stringify(rows), before);
  }
});
it("keeps plain overdrafts, unpaid fees and mixed totals distinct, with no repeated pure debt or false zero", () => {
  for (const currency of ["CAD", "GBP"] as const) {
    for (const [unpaidTotal,overdraft,totalOwed,label] of [
      ["0.00","12398.48","12398.48","Overdraft"],
      ["363.64","0.00","363.64","Unpaid fees"],
      ["363.64","12398.48","12762.12","Total owed"],
    ]) {
      const summary={totalUnpaid:unpaidTotal,totalOverdraft:overdraft,totalOwed,
        accounts:[{accountId:901,accountName:"Brokerage Account",unpaidTotal,overdraft,amountOwed:totalOwed,unpaidCount:1}]};
      const before=JSON.stringify(summary);
      const html=render(FeeLiability,{summary,currency},[]);
      assert(html.includes("Brokerage Account") && html.includes(label));
      assert.equal(displayedValue(html,"text-total-fee-debt"),formatBalance(totalOwed,currency));
      if(label!=="Total owed") assert.equal(html.split(formatBalance(totalOwed,currency)).length-1,1);
      for(const jargon of ["negative cash ledger","assessments","No interest","0.00 unpaid","unpaid fees</"]) assert(!html.includes(jargon));
      if(currency==="GBP") assert(!/\bCAD\b|\bGBP\b/.test(html));
      assert.equal(JSON.stringify(summary),before);
    }
    assert.equal(render(FeeLiability,{summary:{totalUnpaid:"0.00",totalOverdraft:"0.00",accounts:[]},currency},[]),"");
    for(const summary of [
      {totalUnpaid:"NaN",accounts:[]},
      {totalUnpaid:"0.00",totalOverdraft:"12398.48",accounts:[]},
      {totalUnpaid:"0.00",totalOverdraft:"0.00",totalOwed:"12398.48",accounts:[]},
    ]) {
      const html=render(FeeLiability,{summary,currency},[]);
      assert(html.includes('role="alert"') && html.includes("Retry"));
      assert(!html.includes('data-testid="text-total-fee-debt"'));
    }
  }
});
it("shows a normal named GBP debt card below the funded balance without changing access locks",()=>{
  const data=dashboardData([
    {id:25,accountType:"Brokerage Account",balance:"-12398.48"},
    {id:26,accountType:"Trust Account",displayName:"Inheritance Trust Account",balance:"1622886.00"},
  ]);
  data.push({key:["/api/user"],value:{id:7,name:"Mary Scott",clientRef:"VWMS2024",displayCurrency:"GBP",debtClearanceRequired:true}});
  data.push({key:["/api/funds-access",7],value:{locked:true,requiresPayment:true,paymentRecorded:false,totalOwed:"12398.48",paymentAccountId:25,paymentAccountName:"Brokerage Account"}});
  const html=render(DashboardPage,{},data);
  assert.equal(displayedValue(html,"text-total-balance"),"£1,622,886.00");
  const notice=html.match(/<article[^>]*data-testid="debt-account-25"[^>]*>[\s\S]*?<\/article>/)?.[0];
  assert(notice);
  assert(notice.includes("Brokerage Account") && !notice.includes('href="/accounts/25"'));
  assert(!notice.includes("Account details") && !notice.includes("Amount owed"));
  assert(notice.includes("text-red-700") && !notice.includes("role=\"alert\""));
  assert.equal(notice.match(/£12,398\.48/g)?.length,1);
  const card=html.match(/<button[^>]*data-testid="dash-account-25"[^>]*>[\s\S]*?<\/button>/)?.[0];
  assert(card);
  assert.equal(displayedValue(card,"dash-account-name-25"),"Brokerage Account");
  assert.equal(displayedValue(card,"dash-account-balance-25"),"-£12,398.48");
  assert.equal(card.match(/£12,398\.48/g)?.length,1);
  assert.equal(displayedValue(html,"text-overdraft"),"-£12,398.48");
  assert.equal(displayedValue(html,"text-unpaid-fees"),"-£12,398.48");
  assert(html.includes("Recent transactions"));
  assert(!html.includes("All account activity"));
  assert(!card.includes("Cash ledger overdraft") && !card.includes("truncate"));
  for (const removed of ["Payment is required", "A separate payment", "Overdrafts and unpaid fees",
    "negative cash ledger", "unpaid assessments", "No interest is added"]) assert(!notice.includes(removed),removed);
  assert(!html.includes('data-testid="button-quick-wire"'));
  for (const action of ["transfer","invest"]) {
    const button=html.match(new RegExp(`<button[^>]*data-testid="button-quick-${action}"[^>]*>`))?.[0];
    assert(button?.includes("data-funds-action") && !button.includes("disabled"),`${action} must provide guarded feedback`);
  }
  assert(html.indexOf('data-testid="text-total-balance"')<html.indexOf('data-testid="debt-account-summary"'));
  assert(!html.includes("Restriction details unavailable"));
  assert(!html.includes("restricted by your administrator"));
  assert(!html.includes("CAD") && !html.includes("GBP") && !html.includes("Account #"));
  assert(!html.includes("Total balance · £"));
  assert(!html.includes("Account figures in £"));
  assert(!html.includes("Last updated"));
});
it("shows Mary's service terms and fees without CAD while preserving stored pricing",()=>{
  const fees={settings:{enabled:false},enrollments:[{...enrollment,accountId:25}],assessments:[],contracts:[]};
  const before=JSON.stringify(fees);
  const html=render(ClientFeesComponent,{accountId:25},[
    {key:["/api/user"],value:{id:7,displayCurrency:"GBP"}},
    {key:["/api/fees",25],value:fees},
  ]);
  assert(html.includes("£363.64"));
  assert(!html.includes("CAD") && !html.includes("GBP"));
  assert.equal(JSON.stringify(fees),before);
});
const enrollment = {
  id: 1, accountId: 1, userId: 1, scheduleId: 1, state: "offered" as const,
  firstChargeDate: "2030-01-31", nextPeriod: 0, acceptedAt: null, createdAt: "2030-01-01T12:00:00Z",
  nextChargeDate: null, schedule, accountName: "Brokerage Account", userName: "Synthetic fixture",
};
function render(Component: React.ElementType, props: unknown, data: { key: unknown[]; value: unknown }[], errors: unknown[][] = []) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity, gcTime: 0 } } });
  for (const item of data) client.setQueryData(item.key, item.value);
  const snapshotKey = ["/api/accounts", "snapshot", 7];
  if (Component === DashboardPage) {
    // Reuse the synthetic fixture builders, but seed the dashboard's single
    // response, not two independent live queries.
    const accounts = data.find(item => item.key[0] === "/api/accounts" && item.key.length === 1);
    const summary = data.find(item => item.key[0] === "/api/fees" && item.key[1] === "summary");
    if (accounts && summary) client.setQueryData(snapshotKey, { accounts: accounts.value, feeSummary: summary.value });
  }
  for (const key of errors) client.getQueryCache().build(client, { queryKey:
    Component === DashboardPage && (key[0] === "/api/accounts" && key.length === 1 ||
      key[0] === "/api/fees" && key[1] === "summary") ? snapshotKey : key,
  }).setState({
    status: "error", error: new Error("Synthetic query failure"), fetchStatus: "idle",
  });
  const html = renderToStaticMarkup(React.createElement(QueryClientProvider, { client },
    React.createElement(Router, { ssrPath: "/" }, React.createElement(Component, props))));
  client.clear();
  return html;
}
function displayedValue(html: string, testId: string) {
  const match=html.match(new RegExp(`data-testid="${testId}"[^>]*>([^<]*)<`));
  assert(match,`Missing ${testId}`);
  return match[1];
}
function dashboardData(accounts: {id:number;accountType:string;balance:string;displayName?:string}[], investments: unknown[] = [], unpaid = "0.00"): { key: unknown[]; value: unknown }[] {
  const primary=accounts.find(a=>a.accountType==="Brokerage Account") || accounts[0];
  const overdraft=accounts.reduce((sum,a)=>sum+Math.max(0,-Number(a.balance)),0);
  return [
    {key:["/api/user"],value:{id:7,name:"Mary Scott",clientRef:"VWMS2024"}},
    {key:["/api/accounts"],value:accounts.map(a=>({...a,userId:7}))},
    {key:["/api/investments"],value:investments},
    {key:["/api/institutional-transfers"],value:[]},
    {key:["/api/accounts",primary?.id || 0,"transactions"],value:[]},
    {key:["/api/transactions"],value:[]},
    {key:["/api/fees","summary",7],value:{
      totalUnpaid:unpaid,totalOverdraft:String(overdraft),totalOwed:String(overdraft+Number(unpaid)),
      accounts:accounts.map((a,i)=>({accountId:a.id,accountName:a.displayName || a.accountType,
        overdraft:String(Math.max(0,-Number(a.balance))),unpaidTotal:i===0?unpaid:"0.00",
        unpaidCount:i===0 && Number(unpaid)>0?1:0,amountOwed:String(Math.max(0,-Number(a.balance))+(i===0?Number(unpaid):0))})),
    }},
  ];
}
describe("Fee interfaces rendered with synthetic cached data", () => {
  it("does not infer performance from synthetic prices, deposits, or fee debt, even on query failures", () => {
    const accounts = [
      {id:901,accountType:"Brokerage Account",balance:"1000000.00"},
      {id:902,accountType:"Trust Account",balance:"-200.00"},
    ];
    for (const currentPrice of ["15", "0", null, "invalid"]) {
      const data = dashboardData(accounts, [
        {id:903,accountId:901,symbol:"SYNTH",shares:"10",purchasePrice:"10",currentPrice},
      ]);
      // This test uses only in-memory records and no shared client's identity.
      data.find(d=>d.key[0]==="/api/user")!.value = {id:7,name:"Synthetic Performance Client"};
      data.find(d=>d.key[0]==="/api/transactions")!.value = [
        {id:904,toAccountId:901,amount:"1000000",description:"Synthetic inheritance deposit",transactionType:"transfer",status:"completed",createdAt:"2026-01-01"},
        {id:905,fromAccountId:902,amount:"200",description:"Synthetic fee overdraft",transactionType:"fee",status:"completed",createdAt:"2026-02-01"},
      ];
      const before = JSON.stringify(data);
      for (const failures of [[], [["/api/investments"]], [["/api/accounts"]], [["/api/transactions"]]]) {
        const dashboard = render(DashboardPage, {}, data, failures);
        assert(!dashboard.includes('data-testid="text-ytd-performance"'));
        assert(!dashboard.includes('data-testid="text-day-performance"'));
        assert(!dashboard.includes('data-testid="text-holdings-performance"'));
        assert(!dashboard.includes('data-testid="holding-pnl-'));
        for (const fixed of ["+8.4", "+8.40", "vs. benchmark"]) assert(!dashboard.includes(fixed));
        assert(!dashboard.includes("Deposits are not investment gains"));
        assert(!dashboard.includes('data-testid="text-performance-explanation"'));
        const accountPage = render(AccountsPage, {}, data, failures);
        assert(!accountPage.includes('data-testid="text-ytd-performance"'));
        assert(!accountPage.includes('data-testid="account-ytd-'));
        assert(!accountPage.includes('data-testid="text-performance-explanation"'));
        for (const fixed of ["+11.4", "+6.40", "+8.4"]) assert(!accountPage.includes(fixed));
      }
      assert.equal(JSON.stringify(data), before);
    }
  });
  it("resolves fee-debt labels from real account records even with stale numbered fee responses",()=>{
    const accounts=[{id:25,accountType:"Brokerage Account",balance:"-12398.48"}];
    const data=dashboardData(accounts);
    const summary=data.find(d=>d.key[0]==="/api/fees")!.value as ClientFeeSummary;
    summary.accounts[0].accountName="Account #25";
    for(const Component of [DashboardPage,AccountsPage]) {
      const html=render(Component,{},data);
      if (Component===DashboardPage) {
        assert.equal(displayedValue(html,"debt-account-name-25"),"Brokerage Account");
        assert.equal(displayedValue(html,"debt-account-amount-25"),"CAD -$12,398.48");
      } else {
        assert(html.includes("Brokerage Account") && html.includes("Amount owed"));
        assert.equal(displayedValue(html,"debt-account-amount-25"),"CAD $12,398.48");
      }
      assert(!html.includes("Account #25"));
      assert(!html.includes('data-testid="debt-account-details-25"'));
    }
    const renamed=render(FeeLiability,{summary,accounts:[{...accounts[0],displayName:"Discretionary Investment Account"}]},[]);
    assert(renamed.includes("Discretionary Investment Account") && renamed.includes("Overdraft"));
    assert(!renamed.includes("Account #25"));
    const unknown=render(FeeLiability,{summary},[]);
    assert(!unknown.includes("Account #25"));
    assert(unknown.includes("Account details unavailable"));
  });
  it("shows pounds by symbol only for an explicitly configured profile, without converting numbers or changing CAD defaults",()=>{
    const data=dashboardData([
      {id:24,accountType:"Trust Account",displayName:"Legacy Trust Account",balance:"0.00"},
      {id:25,accountType:"Brokerage Account",balance:"-12398.48"},
      {id:26,accountType:"Trust Account",displayName:"Inheritance Trust Account",balance:"1622886.00"},
    ]);
    data.find(d=>d.key[0]==="/api/user")!.value={id:7,name:"Mary Scott",clientRef:"VWMS2024",displayCurrency:"GBP"};
    const before=JSON.stringify(data);
    const html=render(DashboardPage,{},data);
    assert.equal(displayedValue(html,"text-total-balance"),"£1,622,886.00");
    assert.equal(displayedValue(html,"text-liquid-cash"),"£1,622,886.00");
    assert.equal(displayedValue(html,"text-investment-value"),"£0.00");
    assert.equal(displayedValue(html,"debt-account-name-25"),"Brokerage Account");
    assert.equal(displayedValue(html,"debt-account-amount-25"),"-£12,398.48");
    assert(!html.includes("GBP"));
    assert(!html.includes("CAD $"));
    assert(!html.includes("Total balance · £"));
    assert(html.includes("Total balance"));
    assert(!html.includes("Account figures in £"));
    assert(!html.includes("Last updated"));
    assert.equal(JSON.stringify(data),before);
    const accountsHtml=render(AccountsPage,{},data);
    assert.equal(displayedValue(accountsHtml,"text-total-balance"),"£1,622,886.00");
    assert.equal(displayedValue(accountsHtml,"account-summary-balance-investment"),"£0.00");
    assert(!accountsHtml.includes('data-testid="account-group-balance-investment"'));
    assert.equal(displayedValue(accountsHtml,"debt-account-amount-25"),"£12,398.48");
    assert(!accountsHtml.includes("£1,610,487.52"));
    assert(!accountsHtml.includes("GBP"));
    assert(!accountsHtml.includes("CAD $"));
    assert.equal(formatBalance("1622886.00"),"CAD $1,622,886.00");
    assert.equal(clientBalanceCurrency({displayCurrency:"CAD"}),"CAD");
    assert.equal(clientBalanceCurrency(null),"CAD");
    assert.equal(balanceCurrencyLabel("GBP"),"£");
    assert.throws(()=>clientBalanceCurrency({displayCurrency:"invalid"}));
    assert.equal(formatBalance("NaN","GBP"),"Unavailable");
    const summary=data.find(d=>d.key[0]==="/api/fees")!.value;
    const hidden=render(FeeLiability,{summary,currency:"GBP",hidden:true},[]);
    assert(!hidden.includes("12,398.48"));
    const hiddenAccount=render(AccountFeeBalance,{cash:"-12398.48",currency:"GBP",hidden:true},[]);
    assert(!hiddenAccount.includes("12,398.48"));
    const csv=accountStatementCsv(26,"VW-TEST-0026",[{id:578,toAccountId:26,amount:"1622886.001",
      description:"Inheritance — family farm sale proceeds",transactionType:"transfer",status:"completed",createdAt:"2026-10-08T16:00:00Z"}],"GBP");
    assert(csv.includes("Amount (£)"));
    assert(csv.includes('"1622886.001"'));
    assert(!csv.includes("GBP"));
  });
  it("shows inheritance history and funded balances on both summary screens without subtracting liabilities",()=>{
    const deposit = {id:88,fromAccountId:null,toAccountId:26,amount:"1622886.00",
      description:"Inheritance — family farm sale proceeds",transactionType:"transfer",status:"completed",createdAt:"2026-10-08T16:00:00Z"};
    const originalAccounts = [
      {id:24,userId:7,accountType:"Trust Account",balance:"-12398.48"},
      {id:25,userId:7,accountType:"Brokerage Account",balance:"-12398.48"},
    ];
    for (const [currentBalance,unpaid,expectedNet,expectedFunded] of [
      ["1622886.00","0.00","CAD $1,598,089.04","CAD $1,622,886.00"],
      ["1622522.36","0.00","CAD $1,597,725.40","CAD $1,622,522.36"],
      ["1622522.36","100.00","CAD $1,597,625.40","CAD $1,622,522.36"],
    ]) {
      const data = [
        {key:["/api/user"],value:{id:7,name:"Mary Scott",clientRef:"VWMS2024"}},
        {key:["/api/accounts"],value:[...originalAccounts,{id:26,userId:7,accountType:"Trust Account",displayName:"Inheritance Trust Account",balance:currentBalance}]},
        {key:["/api/investments"],value:[]},
        {key:["/api/institutional-transfers"],value:[]},
        {key:["/api/accounts",25,"transactions"],value:[]},
        {key:["/api/transactions"],value:[deposit]},
        {key:["/api/fees","summary",7],value:{totalUnpaid:unpaid,totalOverdraft:"24796.96",totalOwed:String(24796.96+Number(unpaid)),
          accounts:originalAccounts.map(a=>({accountId:a.id,overdraft:"12398.48",unpaidTotal:a.id===24?unpaid:"0.00",unpaidCount:Number(unpaid)>0?1:0}))}},
      ];
      for (const Component of [DashboardPage,AccountsPage]) {
        const html=render(Component,{},data);
        assert.equal(displayedValue(html,"text-total-balance"),expectedFunded,Component.name);
        assert.notEqual(displayedValue(html,"text-total-balance"),expectedNet);
        assert(html.includes("Inheritance Trust Account"));
        assert(html.includes("CAD -$12,398.48"));
        assert(!html.includes("Original inheritance deposit"));
        assert(!html.toLowerCase().includes("demo profile"));
      }
      const dashboard=render(DashboardPage,{},data);
      assert(dashboard.includes("Inheritance — family farm sale proceeds"));
      assert(dashboard.includes(transactionDate(deposit.createdAt)));
    }
    const statement=accountStatementCsv(26,"VW-TEST-0026",[deposit]);
    for (const text of ["1622886.00","2026-10-08T16:00:00.000Z","America/Toronto","October 8, 2026",deposit.description]) assert(statement.includes(text),text);
    // A UTC date just after midnight still belongs to the previous Toronto date.
    assert.equal(transactionDate("2026-10-09T00:15:00Z"),"October 8, 2026");
  });
  it("exports account-owned monthly/annual debits, refunds and precise proceeds in CAD statements",()=>{
    const rows = [
      {id:1,toAccountId:null,amount:"363.64",description:"CAD monthly service fee",transactionType:"fee",status:"completed",createdAt:"2026-10-01T14:00:00Z"},
      {id:2,toAccountId:null,amount:"381.00",description:"CAD annual discretionary-management fee",transactionType:"fee",status:"completed",createdAt:"2026-01-01T14:00:00Z"},
      {id:3,toAccountId:24,amount:"381.00",description:"CAD annual management fee refund",transactionType:"fee_refund",status:"completed",createdAt:"2026-10-01T14:00:00Z"},
      {id:4,toAccountId:24,amount:"1000.000001",description:"=untrusted description",transactionType:"sell",status:"completed",createdAt:"2026-10-01T14:00:00Z"},
    ];
    const csv = accountStatementCsv(24,"VW-TEST-0024",rows);
    for(const text of ["Amount (CAD)","Service fee","Management fee",'"-363.64"','"-381.00"','"381.00"','"1000.000001"',"'=untrusted description"]) assert(csv.includes(text),text);
  });
  it("keeps the zero-funded dashboard headline separate from unpaid fees and preserves net account balances", () => {
    const data = [
      { key: ["/api/user"], value: { id: 7, name: "Mary Scott", clientRef: "VWMS2024" } },
      { key: ["/api/accounts"], value: [
        { id: 24, userId: 7, accountType: "Trust Account", balance: "0", createdAt: "2024-01-01T14:00:00Z" },
        { id: 25, userId: 7, accountType: "Brokerage Account", balance: "0", createdAt: "2024-01-01T14:00:00Z" },
      ] },
      { key: ["/api/investments"], value: [] },
      { key: ["/api/accounts", 25, "transactions"], value: [] },
      { key: ["/api/institutional-transfers"], value: [] },
      { key: ["/api/fees", "summary", 7], value: {
        totalUnpaid: "11636.48", accounts: [
          { accountId: 24, unpaidTotal: "11636.48", unpaidCount: 32 },
          { accountId: 25, unpaidTotal: "0.00", unpaidCount: 0 },
        ],
      } },
    ];
    for (const Component of [DashboardPage, AccountsPage]) {
      const html = render(Component, {}, data);
      assert(html.includes(Component===DashboardPage?"CAD -$11,636.48":"CAD $11,636.48"), `${Component.name}: amount owed`);
      assert.equal(html.includes("Amount owed"),Component===AccountsPage);
      if(Component===DashboardPage) {
        assert.equal(displayedValue(html,"text-total-balance"),"CAD $0.00");
        assert.equal(displayedValue(html,"dash-account-balance-24"),"CAD $0.00");
        assert(html.includes("Unpaid fees"));
      } else {
        assert(!html.includes("32 unpaid fees"));
        assert(html.includes("CAD $11,636.48"));
        assert(html.includes("Unpaid fees"));
        assert(!html.includes("Net account balance"));
      }
      assert(!html.includes("demo profile"));
    }
  });
  it("identifies the sole dormant-account overdraft by name, not an account number", () => {
    const summary={totalUnpaid:"0.00",totalOverdraft:"12398.48",totalOwed:"12398.48",accounts:[
      {accountId:24,accountName:"Legacy Trust Account",unpaidTotal:"0.00",unpaidCount:0,overdraft:"0.00",amountOwed:"0.00"},
      {accountId:25,accountName:"Brokerage Account",unpaidTotal:"0.00",unpaidCount:0,overdraft:"12398.48",amountOwed:"12398.48"},
      {accountId:26,accountName:"Inheritance Trust Account",unpaidTotal:"0.00",unpaidCount:0,overdraft:"0.00",amountOwed:"0.00"},
    ]};
    const html=render(FeeLiability,{summary},[]);
    assert(html.includes("Brokerage Account"));
    assert(html.includes("/accounts/25"));
    assert(html.includes("CAD $12,398.48"));
    assert(!html.includes("24,796.96"));
    assert(!html.includes("Trust Account"));
    assert(!html.includes("Account #"));
  });
  it("shows full-digit debt, a negative net account balance, account links and privacy/error states", () => {
    const summary = { totalUnpaid: "11636.48", accounts: [{ accountId: 24, unpaidTotal: "11636.48", unpaidCount: 32 }] };
    const html = render(FeeLiability, { summary }, []);
    for (const text of ["CAD $11,636.48", "Unpaid fees", "owed", "/accounts/24"]) assert(html.includes(text), text);
    for (const text of ["32 unpaid fees", "unpaid assessments", "negative cash ledger"]) assert(!html.includes(text), text);
    const net = render(AccountFeeBalance, { cash: "0", unpaid: "11636.48" }, []);
    assert(net.includes("CAD -$11,636.48"));
    assert(net.includes("Net account balance"));
    assert(!render(FeeLiability, { summary, hidden: true }, []).includes("11,636.48"));
    assert(!render(AccountFeeBalance, { cash: "0", unpaid: "11636.48", hidden: true }, []).includes("11,636.48"));
    assert(render(FeeLiability, { error: true }, []).includes("Amounts owed are unavailable"));
    assert.equal(render(AccountFeeBalance, { cash: "0", unpaid: "0.00" }, []), "");
  });
  it("distinguishes a posted negative ledger overdraft from genuinely unpaid assessments", () => {
    const summary = { totalUnpaid: "0.00", totalOverdraft: "11636.48", totalOwed: "11636.48",
      accounts: [{ accountId: 24, unpaidTotal: "0.00", unpaidCount: 0, overdraft: "11636.48", amountOwed: "11636.48" }] };
    const html = render(FeeLiability, { summary }, []);
    assert(html.includes("CAD $11,636.48"));
    assert(!html.includes("CAD -$11,636.48"));
    assert(html.includes("Overdraft"));
    assert.equal(html.match(/CAD \$11,636\.48/g)?.length,1);
    assert(!html.includes("CAD $0.00") && !html.includes("negative cash ledger"));
    const cash = render(AccountFeeBalance, { cash: "-11636.48", unpaid: "0.00", overdraft: "11636.48" }, []);
    assert(cash.replace(/<[^>]*>/g, "").includes("Overdraft CAD $11,636.48"));
    assert(cash.includes('<span class="whitespace-nowrap">CAD $11,636.48</span>'));
    assert(!cash.includes("Net account balance"));
    assert(render(AccountFeeBalance, { cash: "-381.00" }, []).includes("CAD $381.00"));
  });
  it("shows zero funded cash for negative-only clients while retaining all named overdrafts below", () => {
    const accounts = [
      { id: 24, userId: 7, accountType: "Trust Account", balance: "-12398.48", createdAt: "2024-01-01T14:00:00Z" },
      { id: 25, userId: 7, accountType: "Brokerage Account", balance: "-12398.48", createdAt: "2024-01-01T14:00:00Z" },
    ];
    const data = [
      { key: ["/api/user"], value: { id: 7, name: "Mary Scott", clientRef: "VWMS2024" } },
      { key: ["/api/accounts"], value: accounts },
      { key: ["/api/investments"], value: [] },
      { key: ["/api/accounts", 25, "transactions"], value: [] },
      { key: ["/api/institutional-transfers"], value: [] },
      { key: ["/api/fees", "summary", 7], value: {
        totalUnpaid: "0.00", totalOverdraft: "24796.96", totalOwed: "24796.96",
        accounts: accounts.map(account => ({ accountId: account.id, unpaidTotal: "0.00", unpaidCount: 0, overdraft: "12398.48", amountOwed: "12398.48" })),
      } },
    ];
    for (const Component of [DashboardPage, AccountsPage]) {
      const html = render(Component, {}, data);
      if(Component===DashboardPage) {
        assert.equal(displayedValue(html,"text-total-balance"),"CAD $0.00");
        assert.equal(displayedValue(html,"text-liquid-cash"),"CAD $0.00");
      } else {
        assert.equal(displayedValue(html,"text-total-balance"),"CAD $0.00");
        assert.equal(displayedValue(html,"account-summary-balance-investment"),"CAD $0.00");
        for (const id of [24,25]) assert.equal(displayedValue(html,`debt-account-amount-${id}`),"CAD $12,398.48");
      }
      assert(html.includes("CAD -$12,398.48"), `${Component.name}: full-digit account overdraft`);
      if(Component===DashboardPage) {
        for(const id of [24,25]) assert.equal(displayedValue(html,`debt-account-amount-${id}`),"CAD -$12,398.48");
      } else assert(!html.includes("CAD $24,796.96"), "Separate named debts must not become a combined asset or repeated total");
    }
  });
  it("includes every remaining positive account balance and holdings, excluding debt and unpaid fees without mutating inputs",()=>{
    const accounts=[
      {id:24,accountType:"Trust Account",displayName:"Legacy Trust Account",balance:"0.00"},
      {id:25,accountType:"Brokerage Account",balance:"-12398.48"},
      {id:26,accountType:"Trust Account",displayName:"Inheritance Trust Account",balance:"1622886.00"},
      {id:27,accountType:"Brokerage Account",displayName:"Savings Portfolio",balance:"250.25"},
    ];
    const holdings=[{id:44,accountId:27,symbol:"SYNTH",shares:"10",purchasePrice:"3.00",currentPrice:"3.20"}];
    const data=dashboardData(accounts,holdings,"100.00");
    const before=JSON.stringify(data);
    const html=render(DashboardPage,{},data);
    assert.equal(displayedValue(html,"text-total-balance"),"CAD $1,623,168.25");
    assert.equal(displayedValue(html,"text-liquid-cash"),"CAD $1,623,136.25");
    assert.equal(displayedValue(html,"text-investment-value"),"CAD $32.00");
    assert(html.includes("Total balance"));
    assert(!html.includes("Net worth after unpaid fees"));
    assert.equal(displayedValue(html,"debt-account-name-25"),"Brokerage Account");
    assert.equal(displayedValue(html,"debt-account-amount-25"),"CAD -$12,398.48");
    assert(!html.includes("not subtracted from your total balance"));
    assert(html.indexOf('data-testid="text-total-balance"')<html.indexOf('data-testid="debt-account-summary"'));
    assert.equal(JSON.stringify(data),before,"Rendering must not change saved financial records");
  });
  it("uses current remaining cash after later deductions, not a fixed inheritance deposit",()=>{
    const data=dashboardData([
      {id:25,accountType:"Brokerage Account",balance:"-12398.48"},
      {id:26,accountType:"Trust Account",displayName:"Inheritance Trust Account",balance:"1600000.00"},
    ],[],"200.00");
    const html=render(DashboardPage,{},data);
    assert.equal(displayedValue(html,"text-total-balance"),"CAD $1,600,000.00");
    assert.equal(displayedValue(html,"text-liquid-cash"),"CAD $1,600,000.00");
    assert(!html.includes("1,622,886.00"));
  });
  it("keeps funded headline and each KPI accurate through transfer states and pending transactions",()=>{
    for(const status of ["pending","under_review","approved","liquidating","transfer_out","completed"]) {
      const data=dashboardData([
        {id:25,accountType:"Brokerage Account",balance:"-12398.48"},
        {id:26,accountType:"Trust Account",displayName:"Inheritance Trust Account",balance:"1622886.00"},
      ]);
      data.find(d=>d.key[0]==="/api/institutional-transfers")!.value=[
        {id:99,status,institutionName:"Synthetic Custodian",transferType:"cash"},
      ];
      data.find(d=>d.key[0]==="/api/accounts"&&d.key.length>1)!.value=[
        {id:55,toAccountId:25,amount:"500.00",status:"pending"},
      ];
      const html=render(DashboardPage,{},data);
      assert.equal(displayedValue(html,"text-total-balance"),"CAD $1,622,886.00",status);
      assert.equal(displayedValue(html,"text-liquid-cash"),"CAD $1,622,886.00",status);
      assert.equal(displayedValue(html,"text-investment-value"),"CAD $0.00",status);
      assert(html.includes("CAD $500.00 pending"));
      assert.equal(displayedValue(html,"debt-account-amount-25"),"CAD -$12,398.48");
      assert.equal(html.includes("Transfer on hold"),["approved","liquidating","transfer_out"].includes(status));
      assert(!html.includes("line-through"));
    }
  });
  it("does not replace a real zero holding valuation with purchase cost",()=>{
    const html=render(DashboardPage,{},dashboardData(
      [{id:26,accountType:"Trust Account",balance:"1250.00"}],
      [{id:44,accountId:26,symbol:"SYNTH",shares:"10",purchasePrice:"3.00",currentPrice:"0.00"}],
    ));
    assert.equal(displayedValue(html,"text-total-balance"),"CAD $1,250.00");
    assert.equal(displayedValue(html,"text-investment-value"),"CAD $0.00");
  });
  it("handles empty portfolios and balance query errors explicitly rather than showing a false zero",()=>{
    const empty=render(DashboardPage,{},dashboardData([]));
    assert.equal(displayedValue(empty,"text-total-balance"),"CAD $0.00");
    for(const failedKey of [["/api/accounts"],["/api/investments"]]) {
      const html=render(DashboardPage,{},dashboardData([{id:25,accountType:"Brokerage Account",balance:"1000.00"}]),[failedKey]);
      assert.equal(displayedValue(html,"text-total-balance"),"Unavailable");
      assert(html.includes("Current balances could not be loaded"));
      assert(html.includes("Retry"));
    }
    const loading=render(DashboardPage,{},dashboardData([]).filter(d=>d.key[0]!=="/api/accounts"));
    assert(!loading.includes('data-testid="text-total-balance"'));
    for(const invalidBalance of ["NaN","Infinity","-Infinity"]) {
      const invalid=render(DashboardPage,{},dashboardData([{id:25,accountType:"Brokerage Account",balance:invalidBalance}]));
      assert.equal(displayedValue(invalid,"text-total-balance"),"Unavailable");
      assert.equal(displayedValue(invalid,"text-liquid-cash"),"Unavailable");
    }
  });
  it("keeps the entire snapshot unavailable when it fails or loads, and respects liability privacy",()=>{
    const data=dashboardData([
      {id:25,accountType:"Brokerage Account",balance:"-12398.48"},
      {id:26,accountType:"Trust Account",balance:"1622886.00"},
    ],[],"100.00");
    const error=render(DashboardPage,{},data,[["/api/fees","summary",7]]);
    assert.equal(displayedValue(error,"text-total-balance"),"Unavailable");
    assert.equal(displayedValue(error,"text-overdraft"),"Unavailable");
    assert.equal(displayedValue(error,"text-unpaid-fees"),"Unavailable");
    assert(error.includes("Account balance details are unavailable"));
    assert(error.includes("Retry"));
    const loading=render(DashboardPage,{},data.filter(d=>d.key[0]!=="/api/fees"));
    assert(!loading.includes('data-testid="text-total-balance"'));
    const summary=data.find(d=>d.key[0]==="/api/fees")!.value;
    const hidden=render(FeeLiability,{summary,hidden:true,separateFromBalance:true},[]);
    for(const amount of ["12,398.48","12,498.48","100.00"]) assert(!hidden.includes(amount));
    assert(hidden.includes("Brokerage Account"));
    assert(hidden.includes("••••••"));
    const liability=render(FeeLiability,{summary,separateFromBalance:true},[]);
    assert(liability.includes("Brokerage Account"));
    assert(liability.includes("Overdraft CAD $12,398.48"));
    assert(liability.includes("Unpaid fees CAD $100.00"));
  });
  it("shows exact itemization, terms, date, timezone, optional client consent, and disabled acceptance before consent", () => {
    const data: ClientFees = { settings, enrollments: [enrollment], assessments: [] };
    const html = render(ClientFeesComponent, { accountId: 1 }, [{ key: ["/api/fees", 1], value: data }]);
    for (const text of ["CAD $363.64", "CAD $100.00", "CAD $200.00", "CAD $63.64", "America/Toronto",
      "explicitly consent", "Processing currently disabled", "No fee charges"]) assert(html.includes(text), text);
    assert.match(html, /disabled=""[^>]*>Accept this exact plan/);
    assert(html.includes("January 31, 2030"));
  });
  it("shows paid, waived, and refunded client history with all components and lifecycle controls", () => {
    const data: ClientFees = {
      settings, enrollments: [{ ...enrollment, state: "active", acceptedAt: "2030-01-01T12:00:00Z", nextChargeDate: "2030-02-28" }],
      assessments: ["paid", "waived", "refunded", "unpaid"].map((status, i) => ({
        id: i + 1, enrollmentId: 1, accountId: 1, period: i, dueDate: "2030-01-31",
        components: DEFAULT_FEE_COMPONENTS, total: "363.64", status: status as "paid" | "waived" | "refunded" | "unpaid",
        transactionId: status === "waived" ? null : 1, refundTransactionId: status === "refunded" ? 2 : null,
        reason: null, createdAt: "2030-01-31T12:00:00Z",
      })),
    };
    const html = render(ClientFeesComponent, { accountId: 1 }, [{ key: ["/api/fees", 1], value: data }]);
    for (const text of ["paid", "waived", "refunded", "End enrollment", "February 28, 2030", "Monthly service fee", "January 31, 2030",
      "Unpaid fees", "CAD $363.64", "These fees have not been deducted from your account"]) assert(html.includes(text), text);
  });
  it("renders explicit account-specific management consent, annual calculation, overdraft terms and valuation history", () => {
    const contract = {
      id: 19, accountId: 1, userId: 1, accountName: "Brokerage Account", userName: "Mary Scott",
      state: "offered" as const, openingDate: "2025-01-01", annualMinimum: "381.00",
      annualRatePercent: "1.7", terms: MANAGEMENT_TERMS, nextPeriod: 0,
      nextChargeDate: "2026-01-01", acceptedAt: null, createdAt: "2025-01-01T12:00:00Z",
      funding: "fee_overdraft" as const, pricingInteraction: "additive" as const,
    };
    const data: ClientFees = { settings, enrollments: [], assessments: [], contracts: [contract],
      valuations: [{ id: 1, contractId: 19, period: 0, valuationDate: "2025-12-31", aum: "22000.00", evidence: "Custodian statement verified", createdAt: "2025-12-31T12:00:00Z" }],
      balance: "-381.00" };
    const html = render(ClientFeesComponent, { accountId: 1 }, [{ key: ["/api/fees", 1], value: data }]);
    for (const text of ["Discretionary management", "First annual charge date", "January 1, 2026", "CAD $381.00",
      "1.7%", "fee-overdraft authorization", "Accept this management contract", "separate from monthly service fees",
      "Overdraft"]) assert(html.includes(text), text);
  });
  it("shows both approved historical annual assessments of CAD 381 per Mary account and the 2027 prospective date", () => {
    for (const [accountId, accountName] of [[24, "Trust Account"], [25, "Brokerage Account"]] as const) {
      const contractId = accountId + 100;
      const contract = {
        id: contractId, accountId, userId: 7, accountName, userName: "Mary Scott",
        state: "active" as const, openingDate: "2024-01-01", annualMinimum: "381.00",
        annualRatePercent: "1.7", terms: MANAGEMENT_TERMS, nextPeriod: 2,
        nextChargeDate: "2027-01-01", acceptedAt: "2024-01-02T12:00:00Z", createdAt: "2024-01-01T12:00:00Z",
        funding: "fee_overdraft" as const, pricingInteraction: "additive" as const,
      };
      const assessments = [0, 1].map(period => ({
        id: accountId * 10 + period, enrollmentId: null, contractId, kind: "management" as const,
        funding: "fee_overdraft" as const, accountId, period,
        dueDate: period === 0 ? "2025-01-01" : "2026-01-01",
        components: [{ name: "Annual management", amount: "381.00", serviceDescription: "Greater of annual minimum or holdings rate." }],
        calculation: { annualMinimum: "381.00", annualRatePercent: "1.7", aum: "22000.00", basis: "minimum" },
        total: "381.00", status: "paid" as const, reason: null, transactionId: accountId * 10 + period,
        refundTransactionId: null, createdAt: `${period === 0 ? "2025" : "2026"}-01-01T12:00:00Z`,
      }));
      const data: ClientFees = { settings, enrollments: [], contracts: [contract], assessments,
        valuations: [0, 1].map(period => ({ id: contractId + period, contractId, period,
          valuationDate: period === 0 ? "2024-12-31" : "2025-12-31", aum: "22000.00",
          evidence: `Mary ${accountName} custodian statement period ${period + 1}`, createdAt: "2026-01-01T12:00:00Z" })),
        balance: "-12398.48" };
      const html = render(ClientFeesComponent, { accountId }, [{ key: ["/api/fees", accountId], value: data }]);
      for (const text of ["January 1, 2025", "January 1, 2026", "January 1, 2027", "CAD $381.00",
        "Annual management fee", "Due", "recorded", "fee overdraft", "Confirmed investment values"]) assert(html.includes(text), `${accountName}: ${text}`);
    }
  });
  it("renders admin versioning, eligibility, processing, preview, lifecycle, and audit controls", () => {
    const data: FeeOverview = {
      settings, schedules: [schedule], enrollments: [enrollment], assessments: [], audit: [],
      accounts: [{ id: 1, userId: 1, userName: "Synthetic fixture", accountType: "Brokerage Account", balance: "2800000.00" }],
      contracts: [{
        id: 19, accountId: 1, userId: 1, accountName: "Brokerage Account", userName: "Mary Scott",
        state: "active", openingDate: "2025-01-01", annualMinimum: "381.00", annualRatePercent: "1.7",
        terms: MANAGEMENT_TERMS, nextPeriod: 0, nextChargeDate: "2026-01-01", acceptedAt: "2025-01-02T12:00:00Z",
        createdAt: "2025-01-01T12:00:00Z", funding: "fee_overdraft", pricingInteraction: "additive",
      }],
      valuations: [{ id: 1, contractId: 19, period: 0, valuationDate: "2025-12-31", aum: "22000.00", evidence: "Custodian statement verified", createdAt: "2025-12-31T12:00:00Z" }],
    };
    const preview: FeePreview = { ...settings, today: "2030-01-01", previewToken: "f".repeat(64), charges: [] };
    const html = render(AdminFees, { adminKey: "not-a-real-key" }, [
      { key: ["/api/admin/fees"], value: data }, { key: ["/api/admin/fees/preview"], value: preview },
    ]);
    for (const text of ["Disabled", "Save immutable version", "Offer to client", "CAD $2,800,000.00",
      "Run preview", "No enrollments are due", "client must independently", "Assessments &amp; audit",
      "Discretionary management contracts", "Annual AUM rate", "Record confirmed valuation", "Pause",
      "End", "Custodian statement verified", "Cash only — insufficient cash stays unpaid",
      "Explicit fee overdraft"]) assert(html.includes(text), text);
  });
});
