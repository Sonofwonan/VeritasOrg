import type { Pool, PoolClient } from "pg";
import type { Express, RequestHandler } from "express";
import type { FundsAccess } from "../shared/funds-access";

// A notice decision cannot survive a later payment/credit or fee reduction.
// Fingerprint the whole qualifying history, not MAX(id): an older pending
// transaction may be approved after a newer transaction is already completed.
// This changes notice provenance only, never the actual funds-access policy.
const noticeClearanceEvidence = `md5(concat(
  u.debt_payment_confirmed_at::text, ':',
  (SELECT string_agg(t.id::text || ':' || t.amount::text || ':' || t.status, ',' ORDER BY t.id)
    FROM transactions t WHERE
    (t.status='completed' AND t.to_account_id IN (SELECT a.id FROM accounts a WHERE a.user_id=u.id))
    OR (t.status='failed' AND t.from_account_id IN (SELECT a.id FROM accounts a WHERE a.user_id=u.id))), ':',
  (SELECT string_agg(f.id::text || ':' || f.status, ',' ORDER BY f.id)
    FROM fee_assessments f JOIN accounts a ON a.id=f.account_id
    WHERE a.user_id=u.id AND f.status IN ('paid','waived','refunded'))
))`;

export async function fundsAccess(pool: Pick<Pool, "query"> | PoolClient, userId: number): Promise<FundsAccess> {
  const { rows } = await pool.query(`
    WITH latest_notice AS (
      SELECT id,detail FROM fee_audit WHERE actor='admin' AND action='debt_restriction_notice'
        AND detail->>'userId'=$1::text ORDER BY id DESC LIMIT 1
    ), user_context AS (
      SELECT u.*, CASE WHEN u.debt_clearance_required THEN ${noticeClearanceEvidence}
        ELSE NULL END AS notice_evidence_key FROM users u WHERE u.id=$1::int
    ), debt AS (
      SELECT u.debt_clearance_required, u.debt_payment_confirmed_at, u.debt_payment_account_id,
        (SELECT COALESCE(SUM(GREATEST(-a.balance,0)),0) FROM accounts a WHERE a.user_id=u.id) +
        (SELECT COALESCE(SUM(f.total),0) FROM fee_assessments f JOIN accounts a ON a.id=f.account_id
          WHERE a.user_id=u.id AND f.status='unpaid') AS owed,
        COALESCE((SELECT (f.detail->>'confirmed') = 'true' AND
          f.detail->>'paymentAccountId' = u.debt_payment_account_id::text
          AND f.detail->>'clearanceEvidenceKey' = u.notice_evidence_key
          AND NOT EXISTS (SELECT 1 FROM fee_audit r WHERE r.action='debt_restriction_notice_retired'
            AND r.detail->>'noticeId'=f.id::text)
          FROM latest_notice f),FALSE) AS admin_confirmed,
        (SELECT COALESCE(NULLIF(a.display_name,''),a.account_type) FROM accounts a
          WHERE a.id=u.debt_payment_account_id AND a.user_id=u.id) AS payment_account_name
      FROM user_context u
    )
    SELECT debt_clearance_required AS "requiresPayment",
      debt_payment_confirmed_at IS NOT NULL AS "paymentRecorded",
      debt_clearance_required AND (owed>0 OR debt_payment_confirmed_at IS NULL) AS locked,
      admin_confirmed AND debt_clearance_required AND
        (owed>0 OR debt_payment_confirmed_at IS NULL) AS "debtRestrictionConfirmed",
      owed::text AS "totalOwed", debt_payment_account_id AS "paymentAccountId",
      payment_account_name AS "paymentAccountName",
      (SELECT id FROM latest_notice) AS "latestNoticeId",
      (SELECT detail->>'confirmed'='true' FROM latest_notice) AS "latestNoticeConfirmed"
      FROM debt
  `, [userId]);
  if (rows.length !== 1 || !Number.isFinite(Number(rows[0].totalOwed))) {
    throw new Error("Funds access status unavailable");
  }
  const {latestNoticeId,latestNoticeConfirmed,...access} = rows[0];
  // Observed clearance also retires the decision, even if an external ledger
  // correction did not produce one of the qualifying history events. No cash,
  // payment verification or access-policy fields are changed.
  if (!access.locked && latestNoticeId && latestNoticeConfirmed) {
    await pool.query(`INSERT INTO fee_audit(actor,action,detail)
      SELECT 'system','debt_restriction_notice_retired',
        jsonb_build_object('userId',$1::int,'noticeId',$2::int,'scope','funds','reason','clearance_observed')
      WHERE NOT EXISTS (SELECT 1 FROM fee_audit WHERE action='debt_restriction_notice_retired'
        AND detail->>'noticeId'=$2::text)`,[userId,latestNoticeId]);
  }
  return access;
}

export class FundsAccessError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

/** Records provenance for an EXISTING lock. Never changes cash, policy or clearance. */
export async function recordDebtRestrictionNotice(pool: Pool, userId: number, input: unknown) {
  const data = input as { confirmed?: unknown; reason?: unknown };
  if (!Number.isInteger(userId) || userId <= 0 || typeof data?.confirmed !== "boolean" ||
      typeof data.reason !== "string" || data.reason.trim().length < 5 || data.reason.length > 500) {
    throw new FundsAccessError("Confirm the notice status and enter a reason (5–500 characters)", 400);
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(`SELECT u.id, ${noticeClearanceEvidence} AS evidence_key
      FROM users u WHERE u.id=$1 FOR UPDATE OF u`, [userId]);
    if (!rows.length) throw new FundsAccessError("Client not found", 404);
    const access = await fundsAccess(client, userId);
    if (data.confirmed && (!access.locked || !access.paymentAccountId || !access.paymentAccountName)) {
      throw new FundsAccessError("There is no configured, active debt payment restriction to confirm", 409);
    }
    await client.query(`INSERT INTO fee_audit(actor,action,detail)
      VALUES('admin','debt_restriction_notice',$1::jsonb)`,
      [JSON.stringify({ userId, confirmed: data.confirmed, reason: data.reason.trim(),
        paymentAccountId: access.paymentAccountId, scope: "funds", restrictionReason: "debt",
        clearanceEvidenceKey: rows[0].evidence_key })]);
    const updated = await fundsAccess(client, userId);
    await client.query("COMMIT");
    return updated;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}

export function registerDebtRestrictionNoticeRoutes(app: Express, pool: Pool, requireAdmin: RequestHandler) {
  const admin: RequestHandler = (req, res, next) => {
    if (!process.env.ADMIN_PASSWORD) {
      return void res.status(503).json({ message: "Administrator authentication is not configured" });
    }
    requireAdmin(req, res, next);
  };
  const respond = (work: (req: any) => Promise<unknown>): RequestHandler => async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) throw new FundsAccessError("Invalid client", 400);
      res.json(await work(req));
    } catch (error) {
      res.status(error instanceof FundsAccessError ? error.status : 503).json({
        message: error instanceof FundsAccessError ? error.message : "Restriction details unavailable",
      });
    }
  };
  app.get("/api/admin/users/:id/debt-restriction", admin, respond(req => fundsAccess(pool, Number(req.params.id))));
  app.post("/api/admin/users/:id/debt-restriction", admin,
    respond(req => recordDebtRestrictionNotice(pool, Number(req.params.id), req.body)));
}

/** Trusted admin operation. A pending request alone is never proof of payment. */
export async function approvePayment(pool: Pool, transactionId: number) {
  if (!Number.isInteger(transactionId) || transactionId <= 0) throw new FundsAccessError("Invalid transaction",400);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows: [txn] } = await client.query("SELECT * FROM transactions WHERE id=$1 FOR UPDATE",[transactionId]);
    if (!txn) throw new FundsAccessError("Transaction not found",404);
    if (txn.status !== "pending") throw new FundsAccessError("Only pending transactions can be approved",400);
    if (!Number.isFinite(Number(txn.amount)) || Number(txn.amount) <= 0) throw new FundsAccessError("Invalid transaction amount",400);
    if (txn.from_account_id) {
      const { rows: [source] } = await client.query("SELECT user_id FROM accounts WHERE id=$1",[txn.from_account_id]);
      if (!source) throw new FundsAccessError("Source account unavailable",400);
      if ((await fundsAccess(client,source.user_id)).locked) throw new FundsAccessError("DEBT_PAYMENT_REQUIRED",423);
    }
    if (txn.to_account_id) {
      const { rows: [destination] } = await client.query(`
        SELECT a.user_id,u.debt_clearance_required,u.debt_payment_account_id
        FROM accounts a JOIN users u ON a.user_id=u.id WHERE a.id=$1 FOR UPDATE OF a,u
      `,[txn.to_account_id]);
      if (!destination) throw new FundsAccessError("Destination account unavailable",400);
      await client.query("UPDATE accounts SET balance=balance+$2::numeric WHERE id=$1",[txn.to_account_id,txn.amount]);
      if (!txn.from_account_id && txn.transaction_type === "transfer" &&
          destination.debt_clearance_required && destination.debt_payment_account_id === txn.to_account_id) {
        await client.query("UPDATE users SET debt_payment_confirmed_at=NOW() WHERE id=$1",[destination.user_id]);
        await client.query(`INSERT INTO fee_audit(actor,action,detail) VALUES ('admin','debt_payment_recorded',$1::jsonb)`,
          [JSON.stringify({userId:destination.user_id,accountId:txn.to_account_id,transactionId,amount:txn.amount})]);
      }
    }
    await client.query("UPDATE transactions SET status='completed' WHERE id=$1",[transactionId]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}

export function fundsAccessGuard(pool: Pool, allowPendingDeposit = false): RequestHandler {
  return async (req, res, next) => {
    if (!req.isAuthenticated()) return void res.status(401).json({ message: "Sign in to access your account" });
    try {
      const access = await fundsAccess(pool, (req.user as { id: number }).id);
      // A customer may REQUEST an incoming deposit. This never credits cash or
      // confirms payment; only trusted approval of the incoming record can do so.
      if (!access.locked || (allowPendingDeposit && req.body?.fromAccountId === -1)) return next();
      res.status(423).json({
        message: "DEBT_PAYMENT_REQUIRED",
        detail: "A separate payment must be recorded in the Brokerage Account and the debt cleared before access to funds can be granted.",
      });
    } catch {
      res.status(503).json({ message: "Funds access could not be verified. No financial action has been authorized." });
    }
  };
}
