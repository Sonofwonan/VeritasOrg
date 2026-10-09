import assert from "node:assert/strict";
import { describe, it } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Router } from "wouter";
import { ClientFees as ClientFeesComponent } from "../../client/src/components/fees/client-fees";
import { AdminFees } from "../../client/src/components/fees/admin-fees";
import { FeeLiability, AccountFeeBalance } from "../../client/src/components/fees/fee-liability";
import DashboardPage from "../../client/src/pages/dashboard";
import AccountsPage from "../../client/src/pages/accounts-page";
import { accountStatementCsv } from "../../client/src/lib/account-statement";
import { balanceCurrencyLabel, clientBalanceCurrency, formatBalance } from "../../shared/balance-currency";
import { transactionDate } from "../../shared/account-display";
import { DEFAULT_FEE_COMPONENTS, DEFAULT_FEE_TERMS, MANAGEMENT_TERMS, type ClientFees, type FeeOverview, type FeePreview } from "../../shared/fees";

const settings = { enabled: false, timeZone: "America/Toronto" };
const schedule = {
  id: 1, version: 1, name: "Fixture service plan", currency: "CAD" as const,
  total: "363.64", components: DEFAULT_FEE_COMPONENTS, terms: DEFAULT_FEE_TERMS, createdAt: "2030-01-01T12:00:00Z",
};
const enrollment = {
  id: 1, accountId: 1, userId: 1, scheduleId: 1, state: "offered" as const,
  firstChargeDate: "2030-01-31", nextPeriod: 0, acceptedAt: null, createdAt: "2030-01-01T12:00:00Z",
  nextChargeDate: null, schedule, accountName: "Brokerage Account", userName: "Synthetic fixture",
};
function render(Component: React.ElementType, props: unknown, data: { key: unknown[]; value: unknown }[], errors: unknown[][] = []) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity, gcTime: 0 } } });
  for (const item of data) client.setQueryData(item.key, item.value);
  for (const key of errors) client.getQueryCache().build(client, { queryKey: key }).setState({
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
  it("resolves fee-debt labels from real account records even with stale numbered fee responses",()=>{
    const accounts=[{id:25,accountType:"Brokerage Account",balance:"-12398.48"}];
    const data=dashboardData(accounts);
    const summary=data.find(d=>d.key[0]==="/api/fees")!.value as ClientFeeSummary;
    summary.accounts[0].accountName="Account #25";
    for(const Component of [DashboardPage,AccountsPage]) {
      const html=render(Component,{},data);
      assert(html.includes("Brokerage Account: overdraft CAD $12,398.48"));
      assert(!html.includes("Account #25"));
      assert(html.includes('href="/accounts/25"'));
    }
    const renamed=render(FeeLiability,{summary,accounts:[{...accounts[0],displayName:"Discretionary Investment Account"}]},[]);
    assert(renamed.includes("Discretionary Investment Account: overdraft"));
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
    assert(html.includes("Brokerage Account: overdraft £12,398.48"));
    assert(html.includes("-£12,398.48"));
    assert(!html.includes("GBP"));
    assert(!html.includes("CAD $"));
    assert(html.includes("Total balance · £"));
    assert(html.includes("Account figures in £"));
    assert.equal(JSON.stringify(data),before);
    const accountsHtml=render(AccountsPage,{},data);
    assert(accountsHtml.includes("£1,610,487.52"));
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
    const csv=accountStatementCsv(26,[{id:578,toAccountId:26,amount:"1622886.001",
      description:"Inheritance — family farm sale proceeds",transactionType:"transfer",status:"completed",createdAt:"2026-10-08T16:00:00Z"}],"GBP");
    assert(csv.includes("Amount (£)"));
    assert(csv.includes('"1622886.001"'));
    assert(!csv.includes("GBP"));
  });
  it("shows inheritance history and current funded dashboard balance separately from the accounts overview net total",()=>{
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
        assert(html.includes(Component===DashboardPage?expectedFunded:expectedNet),Component.name);
        if(Component===DashboardPage) assert.equal(displayedValue(html,"text-total-balance"),expectedFunded);
        assert(html.includes("Inheritance Trust Account"));
        assert(html.includes("CAD -$12,398.48"));
        assert(!html.includes("Original inheritance deposit"));
        assert(!html.toLowerCase().includes("demo profile"));
      }
      const dashboard=render(DashboardPage,{},data);
      assert(dashboard.includes("Inheritance — family farm sale proceeds"));
      assert(dashboard.includes(transactionDate(deposit.createdAt)));
    }
    const statement=accountStatementCsv(26,[deposit]);
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
    const csv = accountStatementCsv(24,rows);
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
      for (const text of ["CAD -$11,636.48", "CAD $11,636.48", "Amount owed", "32 unpaid fees", "Net account balance"]) {
        assert(html.includes(text), `${Component.name}: ${text}`);
      }
      if(Component===DashboardPage) assert.equal(displayedValue(html,"text-total-balance"),"CAD $0.00");
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
    for (const text of ["CAD $11,636.48", "Amount owed", "32 unpaid fees", "/accounts/24", "unpaid assessments remain separate from cash"]) assert(html.includes(text), text);
    const net = render(AccountFeeBalance, { cash: "0", unpaid: "11636.48" }, []);
    assert(net.includes("CAD -$11,636.48"));
    assert(net.includes("Net account balance"));
    assert(!render(FeeLiability, { summary, hidden: true }, []).includes("11,636.48"));
    assert(!render(AccountFeeBalance, { cash: "0", unpaid: "11636.48", hidden: true }, []).includes("11,636.48"));
    assert(render(FeeLiability, { error: true }, []).includes("Net balances are unavailable"));
    assert.equal(render(AccountFeeBalance, { cash: "0", unpaid: "0.00" }, []), "");
  });
  it("distinguishes a posted negative ledger overdraft from genuinely unpaid assessments", () => {
    const summary = { totalUnpaid: "0.00", totalOverdraft: "11636.48", totalOwed: "11636.48",
      accounts: [{ accountId: 24, unpaidTotal: "0.00", unpaidCount: 0, overdraft: "11636.48", amountOwed: "11636.48" }] };
    const html = render(FeeLiability, { summary }, []);
    assert(html.includes("CAD $11,636.48"));
    assert(html.includes("CAD -$11,636.48"));
    assert(html.includes("posted negative cash ledger"));
    assert(html.includes("CAD $0.00 unpaid assessments"));
    const cash = render(AccountFeeBalance, { cash: "-11636.48", unpaid: "0.00", overdraft: "11636.48" }, []);
    assert(cash.includes("Cash ledger overdraft CAD -$11,636.48"));
    assert(!cash.includes("Net account balance"));
    assert(render(AccountFeeBalance, { cash: "-381.00" }, []).includes("CAD -$381.00"));
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
      } else assert(html.includes("CAD -$24,796.96"),"Accounts overview net accounting remains unchanged");
      assert(html.includes("CAD -$12,398.48"), `${Component.name}: full-digit account overdraft`);
      assert(html.includes("CAD $24,796.96"), `${Component.name}: amount owed`);
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
    assert(html.includes("Brokerage Account: overdraft CAD $12,398.48"));
    assert(html.includes("not subtracted from the total balance above"));
    assert(html.indexOf('data-testid="text-total-balance"')<html.indexOf('aria-label="Outstanding service fees"'));
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
      assert(html.includes("Brokerage Account: overdraft CAD $12,398.48"));
      assert.equal(html.includes("Transfer locked"),["approved","liquidating","transfer_out"].includes(status));
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
  it("preserves funded balance when fee details fail or load, and keeps separate liability amounts hidden when requested",()=>{
    const data=dashboardData([
      {id:25,accountType:"Brokerage Account",balance:"-12398.48"},
      {id:26,accountType:"Trust Account",balance:"1622886.00"},
    ],[],"100.00");
    const error=render(DashboardPage,{},data,[["/api/fees","summary",7]]);
    assert.equal(displayedValue(error,"text-total-balance"),"CAD $1,622,886.00");
    assert(error.includes("Overdraft and fee details could not be loaded"));
    assert(error.includes("Retry"));
    const loading=render(DashboardPage,{},data.filter(d=>d.key[0]!=="/api/fees"));
    assert.equal(displayedValue(loading,"text-total-balance"),"CAD $1,622,886.00");
    assert(loading.includes("Loading overdraft and fee details"));
    const summary=data.find(d=>d.key[0]==="/api/fees")!.value;
    const hidden=render(FeeLiability,{summary,hidden:true,separateFromBalance:true},[]);
    for(const amount of ["12,398.48","12,498.48","100.00"]) assert(!hidden.includes(amount));
    assert(hidden.includes("Brokerage Account"));
    assert(hidden.includes("••••••"));
    const liability=render(FeeLiability,{summary,separateFromBalance:true},[]);
    assert(liability.includes("Brokerage Account: overdraft CAD $12,398.48"));
    assert(liability.includes("CAD $100.00 unpaid fees"));
  });
  it("shows exact itemization, terms, date, timezone, optional client consent, and disabled acceptance before consent", () => {
    const data: ClientFees = { settings, enrollments: [enrollment], assessments: [] };
    const html = render(ClientFeesComponent, { accountId: 1 }, [{ key: ["/api/fees", 1], value: data }]);
    for (const text of ["CAD $363.64", "CAD $100.00", "CAD $200.00", "CAD $63.64", "America/Toronto",
      "explicitly consent", "Processing currently disabled", "No fee assessments"]) assert(html.includes(text), text);
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
    for (const text of ["paid", "waived", "refunded", "End enrollment", "February 28, 2030", "period 1", "period 3",
      "Outstanding unpaid assessments", "CAD $363.64", "Posted overdraft is reflected in the negative cash ledger"]) assert(html.includes(text), text);
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
      "1.7%", "fee-overdraft authorization", "Accept this management contract", "independent of monthly",
      "Posted negative cash ledger"]) assert(html.includes(text), text);
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
        "Annual management fee", "period 1", "period 2", "fee overdraft", "documented valuation"]) assert(html.includes(text), `${accountName}: ${text}`);
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
