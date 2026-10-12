import type { Pool, PoolClient } from "pg";
import { evidenceUnits } from "../../shared/history-import";
import { INHERITANCE, INHERITANCE_DATE_CORRECTION } from "./inheritance";
export { INHERITANCE_DATE_CORRECTION } from "./inheritance";
const iso = (value: Date | string) => new Date(value).toISOString();
const sameMoney = (a: string, b: string) => evidenceUnits(a) === evidenceUnits(b);

/** Hash protected rows inside SQL; never return passwords or security material. */
export async function inheritanceProtectedSnapshot(c: PoolClient, userId: number) {
  const result: Record<string,string> = {};
  for (const [key, sql] of [
    ["accounts", "SELECT * FROM accounts WHERE user_id=$1"],
    ["transactions", "SELECT * FROM transactions WHERE from_account_id IN(SELECT id FROM accounts WHERE user_id=$1) OR to_account_id IN(SELECT id FROM accounts WHERE user_id=$1)"],
    ["holdings", "SELECT * FROM investments WHERE account_id IN(SELECT id FROM accounts WHERE user_id=$1)"],
    ["enrollments", "SELECT * FROM fee_enrollments WHERE user_id=$1"],
    ["contracts", "SELECT * FROM management_contracts WHERE user_id=$1"],
    ["assessments", "SELECT * FROM fee_assessments WHERE account_id IN(SELECT id FROM accounts WHERE user_id=$1)"],
    ["cash", "SELECT * FROM account_cash_changes WHERE account_id IN(SELECT id FROM accounts WHERE user_id=$1)"],
    ["user", "SELECT * FROM users WHERE id=$1"],
    ["security", "SELECT user_id AS id,to_jsonb(s) AS security_row FROM client_security s WHERE user_id=$1"],
    ["imports", "SELECT * FROM historical_balance_imports WHERE user_id=$1"],
    ["postings", "SELECT * FROM historical_balance_postings WHERE account_id IN(SELECT id FROM accounts WHERE user_id=$1)"],
    ["processing", "SELECT * FROM fee_settings WHERE $1>0"],
  ]) {
    const { rows: [row] } = await c.query(
      `SELECT md5(COALESCE(jsonb_agg(to_jsonb(r) ORDER BY r.id)::text,'[]')) AS hash FROM (${sql}) r`, [userId]);
    result[key] = row.hash;
  }
  return JSON.stringify(result);
}

/**
 * Explicit fixture-only operation. Not a public endpoint, migration or job.
 * Original transaction and accepted history are never updated.
 */
export async function correctInheritanceDate(
  pool: Pool, userId: number, apply = false, requireMary = false,
) {
  const c = await pool.connect();
  try {
    await c.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
    await c.query("SELECT pg_advisory_xact_lock(7429,1)");
    const { rows: [user] } = await c.query("SELECT id,name,client_ref FROM users WHERE id=$1 FOR UPDATE", [userId]);
    if (!user || (requireMary && (user.name !== "Mary Scott" || user.client_ref !== "VWMS2024"))) {
      throw new Error("The explicitly authorized fictional owner was not found");
    }
    const { rows: accounts } = await c.query("SELECT * FROM accounts WHERE user_id=$1 ORDER BY id FOR UPDATE", [userId]);
    if (requireMary && (accounts.length !== 2 || accounts.some(a => !a.is_demo))) {
      throw new Error("The authorized fictional account scenario changed");
    }
    const { rows: markers } = await c.query(`SELECT id,detail FROM fee_audit WHERE actor='test_fixture'
      AND action='fictional_inheritance_account_created' AND detail->>'userId'=$1
      AND detail->>'synthetic'='true'`, [String(userId)]);
    if (markers.length !== 1 || !markers[0].detail.authorization) throw new Error("Missing or ambiguous fictional inheritance authorization");
    const marker = markers[0], detail = marker.detail;
    const account = accounts.find(a => a.id === detail.accountId);
    const { rows: [transaction] } = await c.query("SELECT * FROM transactions WHERE id=$1 FOR UPDATE", [detail.transactionId]);
    if (!account || !account.is_demo || account.account_type !== "Trust Account" ||
      account.display_name !== INHERITANCE.displayName || detail.amount !== INHERITANCE.amount ||
      iso(detail.timestamp) !== iso(INHERITANCE.timestamp) ||
      !transaction || !transaction.is_demo || transaction.from_account_id !== null ||
      transaction.to_account_id !== account.id || transaction.amount !== INHERITANCE.amount ||
      transaction.status !== "completed" || transaction.transaction_type !== "transfer" ||
      transaction.cash_debit_deferred || transaction.description !== INHERITANCE.description ||
      iso(transaction.created_at) !== iso(INHERITANCE.timestamp)) {
      throw new Error("The original fictional inheritance record changed; refusing a date correction");
    }
    if (requireMary) {
      const { rows: [enrollment] } = await c.query(`SELECT e.account_id,e.user_id,e.first_charge_date,s.total,s.funding
        FROM fee_enrollments e JOIN fee_schedules s ON s.id=e.schedule_id WHERE e.id=$1`, [detail.enrollmentId]);
      if (!enrollment || enrollment.account_id !== account.id || enrollment.user_id !== userId ||
        enrollment.first_charge_date !== INHERITANCE.firstChargeDate ||
        enrollment.total !== INHERITANCE.monthlyFee || enrollment.funding !== "fee_overdraft") {
        throw new Error("Inheritance fee provenance changed; no date or fee alteration was applied");
      }
    }
    const { rows: evidence } = await c.query(`SELECT h.*,i.user_id,i.source,i.fingerprint,
      i.opening_balance,i.closing_balance,i.posting_count,i.start_at,i.end_at
      FROM historical_balance_postings h JOIN historical_balance_imports i ON i.id=h.import_id
      WHERE h.transaction_id=$1`, [transaction.id]);
    if (evidence.length !== 1) throw new Error("Missing or ambiguous accepted balance evidence");
    const history = evidence[0];
    const { rows: authorized } = await c.query(`SELECT id FROM fee_audit WHERE actor='test_fixture'
      AND action='fictional_balance_history_authorized' AND detail->>'synthetic'='true'
      AND detail->>'userId'=$1 AND detail->>'accountId'=$2 AND detail->>'sourceSha256'=$3`,
      [String(userId),String(account.id),history.source.sha256]);
    const { rows: [live] } = await c.query("SELECT count(*)::integer AS n FROM account_cash_changes WHERE transaction_id=$1", [transaction.id]);
    if (history.account_id !== account.id || history.user_id !== userId ||
      history.source.kind !== "synthetic_fixture" || !history.source.ownerAuthorized ||
      !history.source.complete || !history.source.attested || authorized.length !== 1 ||
      history.posting_count !== 1 || history.kind !== "transaction" ||
      iso(history.occurred_at) !== iso(INHERITANCE.timestamp) || live.n !== 0 ||
      !sameMoney(history.opening_balance,"0") || !sameMoney(history.closing_balance,INHERITANCE.amount) ||
      !sameMoney(history.delta,INHERITANCE.amount) || !sameMoney(history.balance_after,INHERITANCE.amount)) {
      throw new Error("Accepted synthetic inheritance evidence does not match the authorized original");
    }
    const { rows: prior } = await c.query("SELECT * FROM transaction_date_corrections WHERE transaction_id=$1", [transaction.id]);
    const output = {
      userId, accountId: account.id, transactionId: transaction.id,
      originalDate: INHERITANCE.date, effectiveDate: INHERITANCE_DATE_CORRECTION.date,
      originalTimestamp: iso(transaction.created_at), effectiveTimestamp: INHERITANCE_DATE_CORRECTION.timestamp,
      amount: transaction.amount, balanceAfter: history.balance_after, currentBalance: account.balance,
      originalImportId: history.import_id, financialRecordsUnchanged: true,
    };
    if (prior.length) {
      const correction = prior[0];
      const { rows: audits } = await c.query(`SELECT id FROM fee_audit WHERE actor='test_fixture'
        AND action=$1 AND detail->>'correctionId'=$2 AND detail->>'transactionId'=$3
        AND detail->>'synthetic'='true'`, [INHERITANCE_DATE_CORRECTION.action,String(correction.id),String(transaction.id)]);
      if (correction.account_id !== account.id || correction.user_id !== userId ||
        iso(correction.original_at) !== output.originalTimestamp ||
        iso(correction.effective_at) !== output.effectiveTimestamp ||
        correction.historical_import_id !== history.import_id ||
        correction.original_fingerprint !== history.fingerprint ||
        correction.authorization_detail.provenanceAuditId !== marker.id || audits.length !== 1) {
        throw new Error("An existing date correction is inconsistent; refusing to overwrite evidence");
      }
      await c.query("ROLLBACK");
      return { alreadyApplied: true, ...output };
    }
    const { rows: trustTransactions } = await c.query("SELECT id FROM transactions WHERE from_account_id=$1 OR to_account_id=$1", [account.id]);
    const { rows: imports } = await c.query("SELECT id FROM historical_balance_imports WHERE account_id=$1", [account.id]);
    if (trustTransactions.length !== 1 || imports.length !== 1 || !sameMoney(account.balance,INHERITANCE.amount)) {
      throw new Error("The trust history changed; review intervening activity before changing its effective date");
    }
    if (!apply) {
      await c.query("ROLLBACK");
      return { alreadyApplied: false, previewOnly: true, ...output };
    }
    const before = await inheritanceProtectedSnapshot(c,userId);
    const authorization = {
      synthetic: true, reason: INHERITANCE_DATE_CORRECTION.authorization,
      provenanceAuditId: marker.id, originalSourceSha256: history.source.sha256,
      originalPostingId: history.id, protectedSnapshot: before, timezone: "America/Toronto",
      originalHistoryRetained: true, financialWrites: false,
    };
    const { rows: [correction] } = await c.query(`INSERT INTO transaction_date_corrections
      (transaction_id,account_id,user_id,original_at,effective_at,historical_import_id,original_fingerprint,authorization_detail)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb) RETURNING id`,
      [transaction.id,account.id,userId,output.originalTimestamp,output.effectiveTimestamp,
        history.import_id,history.fingerprint,JSON.stringify(authorization)]);
    await c.query(`INSERT INTO fee_audit(actor,action,detail) VALUES('test_fixture',$1,$2::jsonb)`,
      [INHERITANCE_DATE_CORRECTION.action,JSON.stringify({ ...authorization,...output,correctionId:correction.id })]);
    if (before !== await inheritanceProtectedSnapshot(c,userId)) throw new Error("Protected records changed; correction rolled back");
    await c.query("COMMIT");
    return { alreadyApplied: false, ...output };
  } catch (error) { await c.query("ROLLBACK"); throw error; }
  finally { c.release(); }
}
