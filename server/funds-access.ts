import type { Pool, PoolClient } from "pg";
import type { RequestHandler } from "express";
import type { FundsAccess } from "../shared/funds-access";

export async function fundsAccess(pool: Pick<Pool, "query"> | PoolClient, userId: number): Promise<FundsAccess> {
  const { rows } = await pool.query(`
    WITH debt AS (
      SELECT u.debt_clearance_required, u.debt_payment_confirmed_at, u.debt_payment_account_id,
        (SELECT COALESCE(SUM(GREATEST(-a.balance,0)),0) FROM accounts a WHERE a.user_id=u.id) +
        (SELECT COALESCE(SUM(f.total),0) FROM fee_assessments f JOIN accounts a ON a.id=f.account_id
          WHERE a.user_id=u.id AND f.status='unpaid') AS owed,
        (SELECT COALESCE(NULLIF(a.display_name,''),a.account_type) FROM accounts a
          WHERE a.id=u.debt_payment_account_id AND a.user_id=u.id) AS payment_account_name
      FROM users u WHERE u.id=$1
    )
    SELECT debt_clearance_required AS "requiresPayment",
      debt_payment_confirmed_at IS NOT NULL AS "paymentRecorded",
      debt_clearance_required AND (owed>0 OR debt_payment_confirmed_at IS NULL) AS locked,
      owed::text AS "totalOwed", debt_payment_account_id AS "paymentAccountId",
      payment_account_name AS "paymentAccountName" FROM debt
  `, [userId]);
  if (rows.length !== 1 || !Number.isFinite(Number(rows[0].totalOwed))) {
    throw new Error("Funds access status unavailable");
  }
  return rows[0];
}

export class FundsAccessError extends Error {
  constructor(message: string, public status: number) { super(message); }
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
