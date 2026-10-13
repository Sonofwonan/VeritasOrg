import { test, expect, login } from "./fixtures";
import { initializeAccountHistory } from "../../server/account-history";
import { FeeService } from "../../server/fees/service";
import { formatBalance } from "../../shared/balance-currency";
import { DEFAULT_FEE_COMPONENTS } from "../../shared/fees";
import { readFile } from "node:fs/promises";

for (const currency of ["CAD", "GBP"] as const) {
  test(`permanent identifiers and authoritative cash history in ${currency}`, async ({ page, identity, db }, info) => {
    test.setTimeout(180000);
    const admin = { "x-admin-key": process.env.BALANCE_E2E_ADMIN! };
    const money = (value: string) => formatBalance(value, currency);
    await db.query("UPDATE users SET display_currency=$2 WHERE id=$1", [identity.userId, currency]);
    const accountsBefore = (await db.query("SELECT id,account_number,balance FROM accounts WHERE user_id=$1 ORDER BY id", [identity.userId])).rows;
    expect(new Set(accountsBefore.map(a => a.account_number)).size).toBe(accountsBefore.length);
    expect(accountsBefore.every(a => /^VW-[A-F0-9]{16}$/.test(a.account_number))).toBe(true);
    await initializeAccountHistory(db);
    await initializeAccountHistory(db);
    expect((await db.query("SELECT id,account_number,balance FROM accounts WHERE user_id=$1 ORDER BY id", [identity.userId])).rows).toEqual(accountsBefore);
    await expect(db.query("UPDATE accounts SET account_number='VW-CHANGED' WHERE id=$1", [identity.funded])).rejects.toThrow("permanent");
    await expect(db.query("INSERT INTO accounts(user_id,account_type,balance,account_number) VALUES($1,'Trust Account',0,$2)", [identity.userId, accountsBefore[0].account_number])).rejects.toThrow("duplicate");
    await db.query("UPDATE accounts SET display_name='Renamed Account' WHERE id=$1", [identity.funded]);
    const fundedNumber = accountsBefore.find(a => a.id === identity.funded).account_number;
    await login(page, identity);
    const create = await page.request.post("/api/accounts", { data: { accountType: "Trust Account", balance: "0" } });
    expect(create.status()).toBe(201);
    const newAccount = await create.json();
    expect(newAccount.accountNumber).toMatch(/^VW-[A-F0-9]{16}$/);
    expect((await db.query("SELECT id FROM transactions WHERE from_account_id=$1 OR to_account_id=$1", [newAccount.id])).rows).toEqual([]);
    const list = await (await page.request.get("/api/accounts")).json();
    expect(list.find((a: any) => a.id === identity.funded).accountNumber).toBe(fundedNumber);
    const legacy = (await db.query(`INSERT INTO transactions(from_account_id,amount,description,transaction_type,status)
      VALUES($1,99,'Historical row without posting evidence','fee','completed') RETURNING id`, [identity.extra])).rows[0];
    const transfer = await page.request.post("/api/transactions/transfer", { data: { fromAccountId: identity.funded, toAccountId: identity.extra, amount: "10.01" } });
    expect(transfer.status()).toBe(201);
    const posted = await transfer.json();
    const history = async () => (await (await page.request.get("/api/transactions")).json()) as any[];
    const accountHistory = async (id: number) => (await (await page.request.get(`/api/accounts/${id}/transactions`)).json()) as any[];
    const getPosting = async (id: number) => (await history()).find(t => t.id === id);
    expect((await getPosting(posted.id)).cashPostings).toEqual([
      { accountId: identity.funded, accountName: "Renamed Account", accountNumber: fundedNumber, balanceAfter: "1999990.24" },
      { accountId: identity.extra, accountName: "Retirement Savings", accountNumber: accountsBefore.find(a => a.id === identity.extra).account_number, balanceAfter: "510.01" },
    ]);
    expect((await getPosting(legacy.id)).cashPostings).toEqual([]);
    const pending = await page.request.post("/api/transactions/transfer", { data: { fromAccountId: -1, toAccountId: identity.debt, amount: "1.25" } });
    const deposit = await pending.json();
    expect((await getPosting(deposit.id)).cashPostings).toEqual([]);
    const approved = await page.request.post(`/api/admin/transactions/${deposit.id}/approve`, { headers: admin });
    expect(approved.status()).toBe(200);
    expect((await getPosting(deposit.id)).cashPostings[0].balanceAfter).toBe("-1249.50");
    const sourceRows = await accountHistory(identity.funded);
    const targetRows = await accountHistory(identity.extra);
    expect(sourceRows.find(t => t.id === posted.id).cashPostings).toEqual([(await getPosting(posted.id)).cashPostings[0]]);
    expect(targetRows.find(t => t.id === posted.id).cashPostings).toEqual([(await getPosting(posted.id)).cashPostings[1]]);
    await page.goto("/dashboard");
    const row = page.getByTestId(`txn-row-${posted.id}`);
    await expect(row).toContainText(`Balance after transaction`);
    await expect(row).toContainText(`Renamed Account`);
    await expect(row).toContainText(money("1999990.24"));
    await expect(row).toContainText(money("510.01"));
    await expect(page.getByTestId("text-overdraft")).toHaveText(money("-1249.50"));
    await expect(page.getByTestId(`dash-account-balance-${identity.debt}`)).toHaveText(money("-1249.50"));
    const main = page.locator("main").last();
    await expect(main).not.toContainText(/Account figures in|Last updated|Data as of/);
    await page.goto(`/accounts/${identity.funded}`);
    await expect(page.getByTestId(`account-txn-row-${posted.id}`)).toContainText(money("1999990.24"));
    await expect(page.getByTestId(`account-txn-row-${posted.id}`)).not.toContainText(money("510.01"));
    await page.getByRole("button", { name: "Account details", exact: true }).click();
    await expect(page.getByRole("dialog")).toContainText(fundedNumber);
    await expect(page.getByRole("dialog")).not.toContainText(identity.ref);
    await page.keyboard.press("Escape");
    const downloadEvent = page.waitForEvent("download");
    await page.getByTestId("button-export-statement").click();
    const download = await downloadEvent;
    expect(download.suggestedFilename()).toContain(fundedNumber);
    const csv = await readFile((await download.path())!, "utf8");
    expect(csv).toContain(`"${fundedNumber}"`);
    expect(csv).toContain(`"-10.01","1999990.24"`);
    for (const width of [320, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const route of ["/dashboard", "/accounts", `/accounts/${identity.funded}`]) {
        await page.goto(route);
        await expect(page.getByTestId(route === "/dashboard" || route === "/accounts" ? "text-total-balance" : "account-detail-balance")).toBeVisible();
        await page.evaluate(() => document.fonts.ready);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      }
    }
    await page.screenshot({ path: info.outputPath(`account-cash-history-${currency}.png`), animations: "disabled" });
  });
}

test("monthly and annual cash fees, refunds, ordering, retry safety and incomplete history", async ({ page, identity, db }) => {
  const admin = { "x-admin-key": process.env.BALANCE_E2E_ADMIN! };
  await login(page, identity);
  const service = new FeeService(db, () => new Date("2026-10-12T16:00:00Z"));
  // Billing configuration is changed only inside this disposable cluster, then restored.
  await service.settings(true);
  try {
    const monthly = await service.assessmentAction(identity.assessment, "retry", "Disposable cash-posting test");
    expect(monthly.status).toBe("paid");
    const balance = (await db.query("SELECT balance FROM accounts WHERE id=$1", [identity.debt])).rows[0].balance;
    expect(balance).toBe("-1614.39");
    const [contract] = (await db.query(`INSERT INTO management_contracts(account_id,user_id,opening_date,annual_minimum,annual_rate_percent,terms,state,accepted_at,accepted_by)
      VALUES($1,$2,'2025-01-01',381,0,'Synthetic accepted annual terms','active','2024-12-01',$2) RETURNING id`, [identity.debt, identity.userId])).rows;
    const [annual] = (await db.query(`INSERT INTO fee_assessments(contract_id,account_id,period,due_date,components,total,status,funding,kind)
      VALUES($1,$2,0,'2026-01-01',$3::jsonb,381,'unpaid','fee_overdraft','management') RETURNING id`,
      [contract.id, identity.debt, JSON.stringify(DEFAULT_FEE_COMPONENTS)])).rows;
    const annualPaid = await service.assessmentAction(annual.id, "retry", "Disposable annual posting");
    const refunded = await service.assessmentAction(annual.id, "refund", "Disposable annual refund");
    expect(refunded.status).toBe("refunded");
    await expect(service.assessmentAction(annual.id, "refund", "Duplicate refund")).rejects.toThrow("Only a paid");
    const history = await (await page.request.get(`/api/accounts/${identity.debt}/transactions`)).json();
    expect(history.find((t: any) => t.id === monthly.transactionId).cashPostings[0].balanceAfter).toBe("-1614.39");
    expect(history.find((t: any) => t.id === annualPaid.transactionId).cashPostings[0].balanceAfter).toBe("-1995.39");
    expect(history.find((t: any) => t.id === refunded.refundTransactionId).cashPostings[0].balanceAfter).toBe("-1614.39");
    // Recorded sequence, not timestamp, defines posting evidence.
    await db.query("UPDATE transactions SET created_at='2026-10-12T15:00:00Z' WHERE id=ANY($1::integer[])",
      [[monthly.transactionId, annualPaid.transactionId, refunded.refundTransactionId]]);
    const after = await (await page.request.get(`/api/accounts/${identity.debt}/transactions`)).json();
    expect(after.map((t: any) => t.id)).toEqual([...after.map((t: any) => t.id)].sort((a, b) => b - a));
    const snapshot = (await db.query("SELECT id,balance FROM accounts WHERE user_id=$1 ORDER BY id", [identity.userId])).rows;
    await page.goto(`/accounts/${identity.debt}`);
    await expect(page.getByTestId(`account-txn-row-${annualPaid.transactionId}`)).toContainText("CAD -$1,995.39");
    await expect(page.getByTestId(`account-txn-row-${refunded.refundTransactionId}`)).toContainText("CAD -$1,614.39");
    const other = (await db.query("SELECT id FROM accounts WHERE user_id<>$1 LIMIT 1", [identity.userId])).rows[0];
    if (other) expect((await page.request.get(`/api/accounts/${other.id}/transactions`)).status()).toBe(403);
    // Pending requests and rejected requests never change the new baseline.
    const pending = await page.request.post("/api/transactions/transfer", { data: { fromAccountId: identity.funded, toAccountId: -2, amount: "123.45" } });
    const t = await pending.json();
    expect(pending.status()).toBe(201);
    const rejected = await page.request.post(`/api/admin/transactions/${t.id}/reject`, { headers: admin });
    expect(rejected.status()).toBe(200);
    expect((await db.query("SELECT id,balance FROM accounts WHERE user_id=$1 ORDER BY id", [identity.userId])).rows).toEqual(snapshot);
    const portfolio = await (await page.request.get("/api/transactions")).json();
    expect(portfolio.find((item: any) => item.id === t.id)).toMatchObject({ status: "failed", cashPostings: [] });
  } finally { await service.settings(false); }
});

test("concurrent transfers and duplicate deposit approval have exact per-account posting evidence", async ({ page, identity, db }) => {
  await login(page, identity);
  const admin = { "x-admin-key": process.env.BALANCE_E2E_ADMIN! };
  const responses = await Promise.all([1, 2, 3].map(() => page.request.post("/api/transactions/transfer",
    { data: { fromAccountId: identity.funded, toAccountId: identity.extra, amount: "1.11" } })));
  expect(responses.map(r => r.status())).toEqual([201, 201, 201]);
  const balances = (await db.query("SELECT balance FROM accounts WHERE id=ANY($1::integer[]) ORDER BY id", [[identity.funded, identity.extra]])).rows;
  expect(balances.map(a => a.balance)).toEqual(["1999996.92", "503.33"]);
  const { rows: postings } = await db.query("SELECT balance_before::text,balance_after::text FROM account_cash_changes WHERE account_id=$1 AND transaction_id IS NOT NULL ORDER BY id", [identity.extra]);
  expect(postings).toEqual([
    { balance_before: "500.00", balance_after: "501.11" },
    { balance_before: "501.11", balance_after: "502.22" },
    { balance_before: "502.22", balance_after: "503.33" },
  ]);
  const request = await page.request.post("/api/transactions/transfer", { data: { fromAccountId: -1, toAccountId: identity.extra, amount: "0.001" } });
  const deposit = await request.json();
  const approvals = await Promise.all([1, 2].map(() => page.request.post(`/api/admin/transactions/${deposit.id}/approve`, { headers: admin })));
  expect(approvals.map(a => a.status()).sort()).toEqual([200, 400]);
  expect((await db.query("SELECT balance FROM accounts WHERE id=$1", [identity.extra])).rows[0].balance).toBe("503.331");
  const history = await (await page.request.get("/api/transactions")).json();
  expect(history.find((t: any) => t.id === deposit.id).cashPostings[0].balanceAfter).toBe("503.331");
});
