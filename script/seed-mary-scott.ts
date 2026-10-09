import assert from "node:assert/strict";
import { randomBytes, scrypt } from "node:crypto";
import { promisify } from "node:util";
import { pool } from "../server/db";
import { billingToday, centsToMoney, moneyToCents, periodDate } from "../shared/fees";

// Explicit, fictional fixture only. Never invoked during startup or publication.
// Internal is_demo flags and append-only audit provenance identify synthetic records;
// client screens use the normal interface without a visible demo label.
const CLIENT_REF = "VWMS2024";
const EMAIL = "mary.scott@fixtures.invalid";
const OPENING = "2024-01-01";
const FIRST_FEE = "2024-03-01";

async function main() {
  if (!process.argv.includes("--create-fictional-fixture")) {
    throw new Error("Run with --create-fictional-fixture only to create the user-authorized fictional Mary Scott account");
  }
  const password = `${randomBytes(15).toString("base64url")}aA9!`;
  const salt = randomBytes(16).toString("hex");
  const derived = await promisify(scrypt)(password, salt, 64) as Buffer;
  const hash = `${derived.toString("hex")}.${salt}`;
  const today = billingToday();
  const dueDates: string[] = [];
  for (let period = 0; periodDate(FIRST_FEE, period) <= today; period++) {
    dueDates.push(periodDate(FIRST_FEE, period));
  }
  const c = await pool.connect();
  let userId: number, trustId: number, investmentId: number, outstanding: string;
  try {
    await c.query("BEGIN");
    await c.query("SELECT pg_advisory_xact_lock(7429,1)");
    const existing = await c.query("SELECT id FROM users WHERE client_ref=$1 OR email=$2", [CLIENT_REF, EMAIL]);
    if (existing.rows.length) throw new Error("This fixture already exists. No records or credentials have been overwritten.");
    const { rows: [schedule] } = await c.query("SELECT * FROM fee_schedules WHERE version=1 AND currency='CAD' AND total=363.64");
    if (!schedule) throw new Error("The original CAD 363.64 service schedule is unavailable");
    const { rows: [user] } = await c.query(`INSERT INTO users(name,email,client_ref,password,created_at,
      login_restricted,account_frozen) VALUES('Mary Scott',$1,$2,$3,$4,false,false) RETURNING id`,
      [EMAIL, CLIENT_REF, hash, `${OPENING}T14:00:00Z`]);
    userId = user.id;
    const { rows: [trust] } = await c.query(`INSERT INTO accounts(user_id,account_type,balance,is_demo,created_at)
      VALUES($1,'Trust Account',0,true,$2) RETURNING id`, [userId, `${OPENING}T14:00:00Z`]);
    const { rows: [investment] } = await c.query(`INSERT INTO accounts(user_id,account_type,balance,is_demo,created_at)
      VALUES($1,'Brokerage Account',0,true,$2) RETURNING id`, [userId, `${OPENING}T14:00:00Z`]);
    trustId = trust.id; investmentId = investment.id;
    const entries = [
      [null, trustId, "121539.00", "Opening deposit", "transfer", `${OPENING}T14:00:00Z`],
      [trustId, investmentId, "60769.50", "Investment account allocation", "transfer", `${OPENING}T14:05:00Z`],
      [trustId, null, "30384.75", "Account distribution", "withdrawal", "2024-01-31T14:00:00Z"],
      [investmentId, null, "30384.75", "Investment account distribution", "withdrawal", "2024-01-31T14:05:00Z"],
      [trustId, null, "30384.75", "Final account distribution", "withdrawal", "2024-02-29T14:00:00Z"],
      [investmentId, null, "30384.75", "Final investment account distribution", "withdrawal", "2024-02-29T14:05:00Z"],
    ];
    for (const entry of entries) await c.query(`INSERT INTO transactions
      (from_account_id,to_account_id,amount,description,transaction_type,created_at,status,is_demo)
      VALUES($1,$2,$3,$4,$5,$6,'completed',true)`, entry);
    const { rows: [enrollment] } = await c.query(`INSERT INTO fee_enrollments
      (account_id,user_id,schedule_id,state,first_charge_date,next_period,accepted_at,accepted_by,created_at)
      VALUES($1,$2,$3,'paused',$4,$5,$6,$2,$6) RETURNING id`,
      [trustId, userId, schedule.id, FIRST_FEE, dueDates.length, "2024-01-01T14:00:00Z"]);
    for (const [period, dueDate] of dueDates.entries()) {
      await c.query(`INSERT INTO fee_assessments(enrollment_id,account_id,period,due_date,components,total,
        status,reason,created_at) VALUES($1,$2,$3,$4,$5::jsonb,$6,'unpaid','Insufficient available cash',$7)`,
        [enrollment.id, trustId, period, dueDate, JSON.stringify(schedule.components), schedule.total, `${dueDate}T14:00:00Z`]);
    }
    outstanding = centsToMoney(moneyToCents(schedule.total) * BigInt(dueDates.length));
    await c.query(`INSERT INTO fee_audit(enrollment_id,actor,action,detail)
      VALUES($1,'test_fixture','fictional_fixture_created',$2::jsonb)`, [enrollment.id, JSON.stringify({
      synthetic: true, authorizedByUserForTesting: true, fictionalIdentity: true,
      fixture: "mary-scott-history", openingDate: OPENING, deposit: "121539.00",
      emptySince: "2024-02-29", firstFeeDate: FIRST_FEE, assessedThrough: today,
      monthlyFee: schedule.total, unpaidPeriods: dueDates.length, outstanding,
      enrollmentPaused: true, processingSettingsUnchanged: true,
      note: "Synthetic history and acceptance for a fictional test identity, not evidence of actual client activity or consent.",
    })]);
    // Reconcile each cash ledger against the signed historical entries before committing.
    const { rows: balances } = await c.query(`SELECT a.id,a.balance,
      COALESCE((SELECT SUM(t.amount) FROM transactions t WHERE t.to_account_id=a.id),0)
      - COALESCE((SELECT SUM(t.amount) FROM transactions t WHERE t.from_account_id=a.id),0) AS reconstructed
      FROM accounts a WHERE a.user_id=$1`, [userId]);
    assert.equal(balances.length, 2);
    for (const a of balances) {
      assert.equal(moneyToCents(a.balance), 0n);
      assert.equal(moneyToCents(a.reconstructed), 0n);
    }
    const { rows: [fees] } = await c.query("SELECT COUNT(*)::int AS n,SUM(total)::text AS total FROM fee_assessments WHERE enrollment_id=$1", [enrollment.id]);
    assert.equal(fees.n, dueDates.length);
    assert.equal(moneyToCents(fees.total), moneyToCents(outstanding));
    await c.query("COMMIT");
  } catch (error) { await c.query("ROLLBACK"); throw error; }
  finally { c.release(); }

  // Verify the real authentication/ownership path without printing cookies, hashes or response bodies.
  const domain = process.env.REPLIT_DEV_DOMAIN;
  if (!domain) throw new Error("Fixture was created, but the development preview domain is unavailable for login verification");
  const base = `https://${domain}`;
  const login = await fetch(`${base}/api/login`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId: CLIENT_REF, password }),
  });
  assert.equal(login.status, 200, "The new client login must succeed");
  const authenticated = await login.json();
  assert.equal(authenticated.id, userId);
  const cookie = login.headers.getSetCookie().map(value => value.split(";")[0]).join("; ");
  assert(cookie, "The client login must establish a session");
  const response = await fetch(`${base}/api/accounts/${trustId}/fees`, { headers: { cookie } });
  assert.equal(response.status, 200);
  const view = await response.json();
  assert.equal(view.enrollments[0].state, "paused");
  assert.equal(view.assessments.length, dueDates.length);
  assert(view.assessments.every((a: any) => a.status === "unpaid" && a.transactionId === null));
  const accountsResponse = await fetch(`${base}/api/accounts`, { headers: { cookie } });
  assert.equal(accountsResponse.status, 200);
  const accounts = await accountsResponse.json();
  assert.equal(accounts.length, 2);
  assert(accounts.every((a: any) => a.userId === userId && moneyToCents(a.balance) === 0n));
  await fetch(`${base}/api/logout`, { method: "POST", headers: { cookie } });
  console.log(JSON.stringify({
    name: "Mary Scott", clientId: CLIENT_REF, loginId: CLIENT_REF, internalUserId: userId,
    password, openingDate: OPENING, initialDeposit: "121539.00", emptySince: "2024-02-29",
    trustAccountId: trustId, investmentAccountId: investmentId,
    historicalTransactions: 6, monthlyFee: "363.64", unpaidPeriods: dueDates.length,
    outstandingServiceFees: outstanding, cashBalance: "0.00",
    loginVerified: true, syntheticRecordsInternallyMarked: true,
    ongoingFeeEnrollment: "paused", globalBillingSettingsUnchanged: true,
  }, null, 2));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => pool.end());
