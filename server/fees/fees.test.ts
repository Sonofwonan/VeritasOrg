import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import { randomBytes } from "node:crypto";
import pg from "pg";
import express from "express";
import type { Server } from "node:http";
import { initializeFeeTables } from "./migration";
import { FeeService } from "./service";
import { registerFeeRoutes } from "./routes";
import {
  availableCashCents, billingToday, centsToMoney, DEFAULT_FEE_COMPONENTS, DEFAULT_FEE_TERMS,
  firstPeriodOnOrAfter, formatCAD, moneyToCents, periodDate, validateBillingDate,
} from "../../shared/fees";

describe("Exact CAD amounts and calendar periods", () => {
  it("adds the agreed components exactly and rejects invalid precision", () => {
    const total = DEFAULT_FEE_COMPONENTS.reduce((n, c) => n + moneyToCents(c.amount), 0n);
    assert.equal(centsToMoney(total), "363.64");
    assert.equal(centsToMoney(moneyToCents("12000000000.99")), "12000000000.99");
    for (const invalid of ["1.001", "NaN", "Infinity", "1e3", ""]) assert.throws(() => moneyToCents(invalid));
    assert.equal(formatCAD("2800000.00"), "CAD $2,800,000.00");
    assert.equal(availableCashCents("1000.001"), 100000n);
    assert.equal(availableCashCents("363.639999"), 36363n);
    assert.equal(availableCashCents("363.640001"), 36364n);
    assert.equal(availableCashCents("-0.0001"), -1n);
    assert.equal(availableCashCents("NaN"), null);
    assert.equal(availableCashCents("Infinity"), null);
  });
  it("keeps the original anniversary across shorter months and leap years", () => {
    assert.equal(periodDate("2030-01-31", 1), "2030-02-28");
    assert.equal(periodDate("2030-01-31", 2), "2030-03-31");
    assert.equal(periodDate("2032-01-31", 1), "2032-02-29");
    assert.equal(firstPeriodOnOrAfter("2030-01-31", "2030-03-01"), 2);
    assert.equal(firstPeriodOnOrAfter("2030-01-31", "2030-02-28"), 1);
    assert.equal(validateBillingDate("2030-02-30"), false);
    assert.equal(billingToday(new Date("2030-01-01T02:00:00Z")), "2029-12-31");
  });
});

describe("Billing persistence in an isolated PostgreSQL schema", () => {
  // No public account, user, or transaction records are used by these tests.
  const schema = `fee_test_${randomBytes(8).toString("hex")}`;
  const connectionString = process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL;
  let control: pg.Pool, pool: pg.Pool, service: FeeService;
  let clock: Date, server: Server, origin: string;
  const config = { connectionString, ssl: { rejectUnauthorized: false } };
  const setDay = (day: string) => { clock = new Date(`${day}T17:00:00Z`); };
  const query = (sql: string, params?: unknown[]) => pool.query(sql, params);
  async function offer(accountId = 1, date = "2030-01-31", scheduleId = 1) {
    return service.offer({ accountId, scheduleId, firstChargeDate: date, servicesConfirmed: true });
  }
  async function accepted(accountId = 1, date = "2030-01-31") {
    const e = await offer(accountId, date);
    await service.accept(accountId, e.id, { scheduleId: 1, accepted: true });
    return e;
  }
  async function request(path: string, body?: unknown, user?: number, admin = false) {
    const response = await fetch(`${origin}${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(user === undefined ? {} : { "x-test-user": String(user) }),
        ...(admin ? { "x-admin-key": "isolated-test-admin" } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
  }
  before(async () => {
    assert(connectionString, "An existing PostgreSQL connection is required; tests never use real accounts");
    control = new pg.Pool(config);
    await control.query(`CREATE SCHEMA "${schema}"`);
    pool = new pg.Pool({ ...config, options: `-c search_path=${schema}`, max: 8 });
    await query(`
      CREATE TYPE transaction_type AS ENUM ('transfer','buy','sell','payment','withdrawal');
      CREATE TABLE users(id SERIAL PRIMARY KEY,name TEXT NOT NULL,account_frozen BOOLEAN DEFAULT FALSE);
      CREATE TABLE accounts(id SERIAL PRIMARY KEY,user_id INTEGER NOT NULL,account_type TEXT NOT NULL,balance NUMERIC NOT NULL);
      CREATE TABLE transactions(id SERIAL PRIMARY KEY,from_account_id INTEGER,to_account_id INTEGER,payee_id INTEGER,
        amount NUMERIC NOT NULL,description TEXT,transaction_type transaction_type NOT NULL,status TEXT NOT NULL,
        is_demo BOOLEAN DEFAULT FALSE,created_at TIMESTAMP DEFAULT NOW());
      CREATE TABLE institutional_transfers(id SERIAL PRIMARY KEY,user_id INTEGER,status TEXT);
    `);
    await initializeFeeTables(pool);
    service = new FeeService(pool, () => clock);
    const app = express();
    app.use(express.json());
    // This synthetic identity exists only in this isolated test app, never the real server.
    app.use((req: any, _res, next) => {
      req.isAuthenticated = () => Boolean(req.header("x-test-user"));
      req.user = { id: Number(req.header("x-test-user")) };
      req.session = { lastActivity: Date.now(), destroy: () => {} };
      next();
    });
    await registerFeeRoutes(app, pool, (req, res, next) => {
      if (req.header("x-admin-key") !== "isolated-test-admin") return void res.status(401).json({ message: "Unauthorized" });
      next();
    });
    server = app.listen(0, "127.0.0.1");
    await new Promise<void>(resolve => server.once("listening", resolve));
    origin = `http://127.0.0.1:${(server.address() as any).port}`;
  });
  beforeEach(async () => {
    setDay("2030-01-01");
    await query("TRUNCATE fee_audit,fee_assessments,fee_enrollments,transactions,institutional_transfers,accounts,users RESTART IDENTITY CASCADE");
    await query("UPDATE fee_settings SET enabled=false");
    await query("INSERT INTO users(name) VALUES('Fixture one'),('Fixture two')");
    await query("INSERT INTO accounts(user_id,account_type,balance) VALUES(1,'Brokerage Account',1000),(2,'Trust Account',1000)");
  });
  after(async () => {
    if (server) await new Promise<void>(resolve => server.close(() => resolve()));
    if (pool) await pool.end();
    if (control) {
      // Drop only the random schema created by this suite, never public objects.
      await control.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await control.end();
    }
  });
  it("initializes disabled without enrolling anyone or changing balances", async () => {
    const view = await service.overview();
    assert.equal(view.settings.enabled, false);
    assert.equal(view.enrollments.length, 0);
    assert.equal(view.schedules[0].total, "363.64");
    assert.equal(view.accounts[0].balance, "1000");
    await assert.rejects(service.run(), /disabled/);
  });
  it("does not charge unaccepted offers and rejects fabricated acceptance or backdating", async () => {
    const e = await offer();
    await service.settings(true);
    setDay("2030-01-31");
    assert.equal((await service.run()).results.length, 0);
    await assert.rejects(service.accept(2, e.id, { scheduleId: 1, accepted: true }), /not found/);
    await assert.rejects(service.accept(1, e.id, { scheduleId: 1, accepted: false }));
    await assert.rejects(service.accept(1, e.id, { scheduleId: 999, accepted: true }), /no longer available/);
    setDay("2030-02-01");
    await assert.rejects(service.accept(1, e.id, { scheduleId: 1, accepted: true }), /has passed/);
    await assert.rejects(offer(2, "2029-12-31"), /future/);
  });
  it("deducts exact cash, records fee direction and itemization, and never charges twice", async () => {
    const e = await accepted();
    await service.settings(true);
    setDay("2030-01-30");
    assert.equal((await service.run()).results.length, 0);
    setDay("2030-01-31");
    const runs = await Promise.all([service.run(), new FeeService(pool, () => clock).run()]);
    const assessed = runs.flatMap(r => r.results);
    assert.equal(assessed.length, 1);
    assert.equal(assessed[0].status, "paid");
    assert.equal(assessed[0].components.length, 3);
    assert.equal((await query("SELECT balance FROM accounts WHERE id=1")).rows[0].balance, "636.36");
    const t = (await query("SELECT * FROM transactions")).rows[0];
    assert.equal(t.transaction_type, "fee"); assert.equal(t.from_account_id, 1); assert.equal(t.to_account_id, null);
    assert.equal((await service.clientView(1, 1)).enrollments[0].nextChargeDate, "2030-02-28");
    assert.equal((await service.run()).results.length, 0);
    assert.equal((await query("SELECT COUNT(*)::integer AS n FROM fee_assessments WHERE enrollment_id=$1", [e.id])).rows[0].n, 1);
  });
  it("keeps insufficient cash unchanged and settles the same assessment on an authorized retry", async () => {
    await accepted(); await service.settings(true); setDay("2030-01-31");
    await query("UPDATE accounts SET balance=100 WHERE id=1");
    const a = (await service.run()).results[0];
    assert.equal(a.status, "unpaid"); assert.equal(a.transactionId, null);
    assert.equal((await query("SELECT balance FROM accounts WHERE id=1")).rows[0].balance, "100");
    await query("UPDATE accounts SET balance=500 WHERE id=1");
    const result = await service.assessmentAction(a.id, "retry", "Fixture retry");
    assert.equal(result.id, a.id); assert.equal(result.status, "paid");
    assert.equal((await query("SELECT balance FROM accounts WHERE id=1")).rows[0].balance, "136.36");
    await assert.rejects(service.assessmentAction(a.id, "retry", "Again"), /Only unpaid/);
  });
  it("previews and settles fractional-cent balances consistently without rewriting their precision", async () => {
    await accepted(); await accepted(2); await service.settings(true); setDay("2030-01-31");
    await query("UPDATE accounts SET balance=1000.001 WHERE id=1");
    await query("UPDATE accounts SET balance=363.639999 WHERE id=2");
    const preview = await service.preview();
    assert.equal(preview.charges.find(c => c.accountId === 1)?.outcome, "payable");
    assert.equal(preview.charges.find(c => c.accountId === 2)?.outcome, "unpaid");
    const run = await service.run("admin", preview.previewToken);
    assert.equal(run.results.find(a => a.accountId === 1)?.status, "paid");
    assert.equal(run.results.find(a => a.accountId === 2)?.status, "unpaid");
    assert.equal((await query("SELECT balance FROM accounts WHERE id=1")).rows[0].balance, "636.361");
    assert.equal((await query("SELECT balance FROM accounts WHERE id=2")).rows[0].balance, "363.639999");
    const unpaid = run.results.find(a => a.accountId === 2)!;
    await query("UPDATE accounts SET balance=363.640001 WHERE id=2");
    assert.equal((await service.assessmentAction(unpaid.id, "retry", "Cash now sufficient")).status, "paid");
    assert.equal((await query("SELECT balance FROM accounts WHERE id=2")).rows[0].balance, "0.000001");
  });
  it("skips non-finite ledger balances in both preview and scheduled processing", async () => {
    await accepted(); await accepted(2); await service.settings(true); setDay("2030-01-31");
    await query("UPDATE accounts SET balance='NaN'::numeric WHERE id=1");
    await query("UPDATE accounts SET balance='Infinity'::numeric WHERE id=2");
    const preview = await service.preview();
    assert(preview.charges.every(c => c.outcome === "skipped"));
    assert(preview.charges.every(c => c.reason?.includes("not a finite decimal")));
    assert((await service.run("scheduler")).results.every(a => a.status === "skipped"));
    assert.equal((await query("SELECT COUNT(*)::int AS n FROM transactions")).rows[0].n, 0);
  });
  it("skips frozen and transfer-locked accounts without deducting funds", async () => {
    await accepted(); await accepted(2); await service.settings(true); setDay("2030-01-31");
    await query("UPDATE users SET account_frozen=true WHERE id=1");
    await query("INSERT INTO institutional_transfers(user_id,status) VALUES(2,'approved')");
    const preview = await service.preview();
    assert(preview.charges.every(c => c.outcome === "skipped"));
    const run = await service.run();
    assert(run.results.every(a => a.status === "skipped"));
    assert.equal((await query("SELECT COUNT(*)::integer AS n FROM transactions")).rows[0].n, 0);
    assert((await query("SELECT balance FROM accounts")).rows.every(a => a.balance === "1000"));
  });
  it("pauses, resumes prospectively without billing paused periods, and ends permanently", async () => {
    const e = await accepted(); await service.settings(true);
    await service.changeState(e.id, "paused");
    setDay("2030-04-01");
    assert.equal((await service.run()).results.length, 0);
    await service.changeState(e.id, "active");
    assert.equal((await service.clientView(1, 1)).enrollments[0].nextChargeDate, "2030-04-30");
    assert.equal((await service.run()).results.length, 0);
    await service.changeState(e.id, "ended", 1);
    setDay("2030-05-31");
    assert.equal((await service.run()).results.length, 0);
    await assert.rejects(service.changeState(e.id, "active"), /already ended/);
  });
  it("waives an unpaid fee without changing cash and cannot waive or retry it again", async () => {
    await accepted(); await service.settings(true); setDay("2030-01-31");
    await query("UPDATE accounts SET balance=0 WHERE id=1");
    const a = (await service.run()).results[0];
    assert.equal((await service.assessmentAction(a.id, "waive", "Service correction")).status, "waived");
    assert.equal((await query("SELECT balance FROM accounts WHERE id=1")).rows[0].balance, "0");
    await assert.rejects(service.assessmentAction(a.id, "waive", "Again"), /Only unpaid/);
    await assert.rejects(service.assessmentAction(a.id, "retry", "Again"), /Only unpaid/);
  });
  it("refunds once, restores exact cash, and preserves original ledger/audit records", async () => {
    await accepted(); await service.settings(true); setDay("2030-01-31");
    const a = (await service.run()).results[0];
    const results = await Promise.allSettled([
      service.assessmentAction(a.id, "refund", "Service correction"),
      service.assessmentAction(a.id, "refund", "Duplicate request"),
    ]);
    assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
    assert.equal((await query("SELECT balance FROM accounts WHERE id=1")).rows[0].balance, "1000.00");
    const ledger = (await query("SELECT * FROM transactions ORDER BY id")).rows;
    assert.equal(ledger.length, 2); assert.equal(ledger[1].transaction_type, "fee_refund");
    assert.equal(ledger[1].to_account_id, 1); assert.equal(ledger[1].from_account_id, null);
    await assert.rejects(query("UPDATE fee_audit SET actor='altered'"), /immutable/);
    await assert.rejects(query("DELETE FROM fee_audit"), /immutable/);
  });
  it("creates immutable schedule versions and preserves accepted prices", async () => {
    const e = await accepted();
    const s = await service.createSchedule({
      name: "Future service schedule",
      components: DEFAULT_FEE_COMPONENTS.map(c => ({ ...c, amount: "20.00" })),
      terms: DEFAULT_FEE_TERMS,
    });
    assert.equal(s.total, "60.00"); assert(s.version > 1);
    assert.equal((await service.clientView(1, 1)).enrollments[0].schedule.total, "363.64");
    await assert.rejects(offer(1, "2030-03-01", s.id), /existing enrollment/);
    await assert.rejects(query("UPDATE fee_schedules SET total=999 WHERE id=1"), /immutable/);
    await assert.rejects(service.changeState(e.id, "active"), /Only a client-accepted/);
    await assert.rejects(service.createSchedule({ name: "Bad", components: DEFAULT_FEE_COMPONENTS.map(c => ({ ...c, amount: "-1" })), terms: DEFAULT_FEE_TERMS }));
  });
  it("rejects stale reviewed previews rather than charging newly changed items", async () => {
    await accepted(); await service.settings(true); setDay("2030-01-31");
    const preview = await service.preview();
    await query("UPDATE accounts SET balance=200 WHERE id=1");
    await assert.rejects(service.run("admin", preview.previewToken), /preview has changed/);
    assert.equal((await query("SELECT COUNT(*)::integer AS n FROM transactions")).rows[0].n, 0);
    const next = await service.preview();
    assert.equal((await service.run("admin", next.previewToken)).results[0].status, "unpaid");
  });
  it("prevents duplicate monthly coverage when an ended plan is replaced by a new version", async () => {
    const e = await accepted(); await service.settings(true); setDay("2030-01-31");
    await service.run();
    await service.changeState(e.id, "ended");
    await assert.rejects(offer(1, "2030-02-01"), /overlapping charges/);
    const next = await offer(1, "2030-02-28");
    assert.equal(next.firstChargeDate, "2030-02-28");
  });
  it("serializes fee deductions with simultaneous locked cash spending", async () => {
    await accepted(); await service.settings(true); setDay("2030-01-31");
    await query("UPDATE accounts SET balance=500 WHERE id=1");
    const spender = await pool.connect();
    try {
      await spender.query("BEGIN");
      await spender.query("SELECT id FROM accounts WHERE id=1 FOR UPDATE");
      const fees = service.run();
      await spender.query("UPDATE accounts SET balance=balance-300 WHERE id=1 AND balance>=300");
      await spender.query("COMMIT");
      const result = await fees;
      assert.equal(result.results[0].status, "unpaid");
      assert.equal((await query("SELECT balance FROM accounts WHERE id=1")).rows[0].balance, "200");
    } finally { spender.release(); }
  });
  it("HTTP routes enforce authentication, ownership, real client consent, and confirmed financial actions", async () => {
    // RegisterFeeRoutes uses the real clock; these tests intentionally exercise only read and invalid actions.
    assert.equal((await request("/api/admin/fees")).status, 401);
    assert.equal((await request("/api/accounts/1/fees")).status, 401);
    assert.equal((await request("/api/accounts/1/fees", undefined, 2)).status, 404);
    assert.equal((await request("/api/accounts/1/fees", undefined, 1)).status, 200);
    const e = await offer();
    assert.equal((await request(`/api/fees/enrollments/${e.id}/accept`, { scheduleId: 1, accepted: true }, 2)).status, 404);
    assert.equal((await request(`/api/fees/enrollments/${e.id}/accept`, { scheduleId: 1, accepted: false }, 1)).status, 400);
    assert.equal((await request(`/api/admin/fees/enrollments/${e.id}/state`, { state: "active" }, undefined, true)).status, 400);
    assert.equal((await request("/api/admin/fees/settings", { enabled: true }, undefined, true)).status, 400);
    assert.equal((await request("/api/admin/fees/run", { confirmed: true }, undefined, true)).status, 400);
    assert.equal((await request("/api/admin/fees/assessments/1/refund", { confirmed: true, reason: "" }, undefined, true)).status, 400);
  });
});
