import { test, expect, login } from "./fixtures";
import { randomBytes } from "node:crypto";
import pg from "pg";
import { initializeAccountHistory } from "../../server/account-history";

test("legacy identifier provisioning changes metadata only and is repeatable", async ({ db }) => {
  const schema = `account_metadata_${randomBytes(8).toString("hex")}`;
  // The fixture has already verified this is the runner-owned local database.
  await db.query(`CREATE SCHEMA ${schema}`);
  const isolated = new pg.Pool({
    connectionString: process.env.BALANCE_E2E_DATABASE,
    options: `-c search_path=${schema}`,
  });
  try {
    await isolated.query(`
      CREATE TABLE accounts(id SERIAL PRIMARY KEY,user_id INTEGER NOT NULL,account_type TEXT,display_name TEXT,balance NUMERIC);
      CREATE TABLE transactions(id SERIAL PRIMARY KEY,from_account_id INTEGER,to_account_id INTEGER,amount NUMERIC,status TEXT);
      INSERT INTO accounts(user_id,account_type,balance) VALUES(1,'Trust Account',123.456),(1,'Brokerage Account',-12398.48);
      INSERT INTO transactions(from_account_id,amount,status) VALUES(2,20,'completed');
    `);
    const before = (await isolated.query("SELECT id,user_id,account_type,balance FROM accounts ORDER BY id")).rows;
    await initializeAccountHistory(isolated);
    const numbered = (await isolated.query("SELECT * FROM accounts ORDER BY id")).rows;
    expect(new Set(numbered.map(a => a.account_number)).size).toBe(2);
    await initializeAccountHistory(isolated);
    expect((await isolated.query("SELECT * FROM accounts ORDER BY id")).rows).toEqual(numbered);
    expect((await isolated.query("SELECT id,user_id,account_type,balance FROM accounts ORDER BY id")).rows).toEqual(before);
    expect((await isolated.query("SELECT count(*) FROM account_cash_changes")).rows[0].count).toBe("0");
    expect((await isolated.query("SELECT * FROM transactions")).rows).toEqual([
      { id: 1, from_account_id: 2, to_account_id: null, amount: "20", status: "completed", cash_debit_deferred: false },
    ]);
  } finally {
    await isolated.end();
    await db.query(`DROP SCHEMA ${schema} CASCADE`);
  }
});

test("storage purchases/sales, paged balances and cross-owner history retain exact evidence", async ({ db, page, identity }) => {
  test.setTimeout(120000);
  await login(page, identity);
  // Import only after isolatedDatabase() has validated the disposable connection.
  const { DatabaseStorage } = await import("../../server/storage");
  const storage = new DatabaseStorage();
  await storage.buyAsset(identity.extra, "ISOLATED_ONLY", "12.34", 2);
  await storage.sellAsset(identity.extra, "ISOLATED_ONLY", "1.0000", 3);
  let history = await (await page.request.get(`/api/accounts/${identity.extra}/transactions`)).json();
  expect(history.find((t: any) => t.transactionType === "buy").cashPostings[0].balanceAfter).toBe("487.66");
  expect(history.find((t: any) => t.transactionType === "sell").cashPostings[0].balanceAfter).toBe("490.66");
  const transfers: any[] = [];
  for (let i = 0; i < 22; i++) {
    const response = await page.request.post("/api/transactions/transfer", {
      data: { fromAccountId: identity.funded, toAccountId: identity.extra, amount: "1.00" },
    });
    expect(response.status()).toBe(201);
    transfers.push(await response.json());
  }
  await page.goto("/transactions");
  await page.getByTestId("transactions-next-page").click();
  const first = page.getByTestId(`transaction-row-${transfers[0].id}`);
  await expect(first).toContainText("Balance after transaction");
  await expect(first).toContainText("CAD $491.66");
  await expect(first).toContainText("CAD $1,999,999.25");
  await page.goto(`/accounts/${identity.extra}`);
  await expect(page.getByTestId(`account-txn-row-${transfers[0].id}`)).toContainText("CAD $491.66");
  const key = randomBytes(8).toString("hex");
  const foreignUser = (await db.query(`INSERT INTO users(name,email,password,client_ref)
    VALUES('Disposable Foreign Owner',$1,'not-a-login',$2) RETURNING id`,
    [`foreign-${key}@example.invalid`, `FOREIGN-${key}`])).rows[0].id;
  const foreign = (await db.query(`INSERT INTO accounts(user_id,account_type,balance,is_demo)
    VALUES($1,'Brokerage Account',10,true) RETURNING id,account_number`, [foreignUser])).rows[0];
  const c = await db.connect();
  let sharedTransaction: number;
  try {
    await c.query("BEGIN");
    await c.query("UPDATE accounts SET balance=balance-2 WHERE id=$1", [foreign.id]);
    await c.query("UPDATE accounts SET balance=balance+2 WHERE id=$1", [identity.extra]);
    sharedTransaction = (await c.query(`INSERT INTO transactions(from_account_id,to_account_id,amount,description,transaction_type,status)
      VALUES($1,$2,2,'Documented incoming transfer','transfer','completed') RETURNING id`,
      [foreign.id, identity.extra])).rows[0].id;
    await c.query("SELECT record_cash_posting($1,$2)", [sharedTransaction, foreign.id]);
    await c.query("SELECT record_cash_posting($1,$2)", [sharedTransaction, identity.extra]);
    await c.query("COMMIT");
  } catch (error) { await c.query("ROLLBACK"); throw error; }
  finally { c.release(); }
  history = await (await page.request.get("/api/transactions")).json();
  const visible = history.find((t: any) => t.id === sharedTransaction);
  expect(visible.cashPostings).toHaveLength(1);
  expect(visible.cashPostings[0].accountId).toBe(identity.extra);
  expect(JSON.stringify(history)).not.toContain(foreign.account_number);
  expect((await page.request.get(`/api/accounts/${foreign.id}/transactions`)).status()).toBe(403);
  // A pending snapshot cannot receive completed evidence if approval races the read.
  const { ownedCashHistory } = await import("../../server/account-history");
  const race = await ownedCashHistory(db, identity.userId, [{ ...visible, status: "pending" }]);
  expect(race[0].cashPostings).toEqual([]);
});

test("outgoing approvals post once and preserve already-reserved legacy payments", async ({ db, page, identity }) => {
  await login(page, identity);
  const admin = { "x-admin-key": process.env.BALANCE_E2E_ADMIN! };
  const payee = (await db.query(`INSERT INTO payees(user_id,name,account_number,bank_name,status)
    VALUES($1,'Disposable approved beneficiary','TEST-ONLY','Test institution','approved') RETURNING id`,
    [identity.userId])).rows[0].id;
  const request = await page.request.post("/api/transactions/payment", {
    data: { fromAccountId: identity.extra, payeeId: payee, amount: "4.44" },
  });
  expect(request.status()).toBe(201);
  const transaction = await request.json();
  expect(transaction.status).toBe("pending");
  const balance = async () => (await db.query("SELECT balance FROM accounts WHERE id=$1", [identity.extra])).rows[0].balance;
  expect(await balance()).toBe("500.00");
  expect((await page.request.post(`/api/admin/transactions/${transaction.id}/approve`, { headers: admin })).status()).toBe(200);
  expect(await balance()).toBe("495.56");
  expect((await page.request.post(`/api/admin/transactions/${transaction.id}/approve`, { headers: admin })).status()).toBe(400);
  expect(await balance()).toBe("495.56");
  let history = await (await page.request.get(`/api/accounts/${identity.extra}/transactions`)).json();
  expect(history.find((t: any) => t.id === transaction.id).cashPostings[0].balanceAfter).toBe("495.56");
  // Model the old reserved-cash behavior only in this disposable database.
  await db.query("UPDATE accounts SET balance=balance-3 WHERE id=$1", [identity.extra]);
  const legacy = (await db.query(`INSERT INTO transactions(from_account_id,payee_id,amount,description,transaction_type,status)
    VALUES($1,$2,3,'Legacy reserved request','payment','pending') RETURNING id`, [identity.extra, payee])).rows[0].id;
  expect((await page.request.post(`/api/admin/transactions/${legacy}/approve`, { headers: admin })).status()).toBe(200);
  expect(await balance()).toBe("492.56");
  history = await (await page.request.get(`/api/accounts/${identity.extra}/transactions`)).json();
  expect(history.find((t: any) => t.id === legacy).cashPostings).toEqual([]);
  const rejected = await (await page.request.post("/api/transactions/payment", {
    data: { fromAccountId: identity.extra, payeeId: payee, amount: "5.00" },
  })).json();
  expect((await page.request.post(`/api/admin/transactions/${rejected.id}/reject`, { headers: admin })).status()).toBe(200);
  expect(await balance()).toBe("492.56");
  history = await (await page.request.get(`/api/accounts/${identity.extra}/transactions`)).json();
  expect(history.find((t: any) => t.id === rejected.id)).toMatchObject({ status: "failed", cashPostings: [] });
});
