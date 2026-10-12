import type { Pool } from "pg";
import type { Transaction } from "@shared/schema";

/** Metadata only: never adjusts cash, seeds history, or executes billing. */
export async function initializeAccountHistory(pool: Pool) {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    await c.query("SELECT pg_advisory_xact_lock(7429, 42)");
    await c.query(`
      ALTER TABLE transactions ADD COLUMN IF NOT EXISTS cash_debit_deferred BOOLEAN NOT NULL DEFAULT FALSE;
      ALTER TABLE accounts ADD COLUMN IF NOT EXISTS account_number TEXT;
      ALTER TABLE accounts ALTER COLUMN account_number SET DEFAULT
        ('VW-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 16)));
      CREATE UNIQUE INDEX IF NOT EXISTS accounts_application_number_unique ON accounts(account_number);
      UPDATE accounts SET account_number=DEFAULT WHERE account_number IS NULL;
      ALTER TABLE accounts ALTER COLUMN account_number SET NOT NULL;
      CREATE TABLE IF NOT EXISTS account_cash_changes (
        id BIGSERIAL PRIMARY KEY,
        account_id INTEGER NOT NULL,
        transaction_xid BIGINT NOT NULL,
        balance_before NUMERIC NOT NULL,
        balance_after NUMERIC NOT NULL,
        transaction_id INTEGER REFERENCES transactions(id),
        posted_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
        UNIQUE(transaction_id, account_id)
      );
      CREATE INDEX IF NOT EXISTS account_cash_changes_link_idx
        ON account_cash_changes(transaction_xid,account_id) WHERE transaction_id IS NULL;
      CREATE OR REPLACE FUNCTION protect_cash_posting_evidence() RETURNS trigger AS $$
      BEGIN
        IF TG_OP='DELETE' OR OLD.transaction_id IS NOT NULL OR
          (NEW.id,NEW.account_id,NEW.transaction_xid,NEW.balance_before,NEW.balance_after,NEW.posted_at)
          IS DISTINCT FROM
          (OLD.id,OLD.account_id,OLD.transaction_xid,OLD.balance_before,OLD.balance_after,OLD.posted_at) THEN
          RAISE EXCEPTION 'Cash posting evidence is immutable';
        END IF;
        RETURN NEW;
      END; $$ LANGUAGE plpgsql;
      DROP TRIGGER IF EXISTS protect_cash_posting_evidence ON account_cash_changes;
      CREATE TRIGGER protect_cash_posting_evidence BEFORE UPDATE OR DELETE ON account_cash_changes
        FOR EACH ROW EXECUTE FUNCTION protect_cash_posting_evidence();
      CREATE OR REPLACE FUNCTION protect_application_account_number() RETURNS trigger AS $$
      BEGIN
        IF NEW.account_number IS DISTINCT FROM OLD.account_number THEN
          RAISE EXCEPTION 'Application account numbers are permanent';
        END IF;
        RETURN NEW;
      END; $$ LANGUAGE plpgsql;
      DROP TRIGGER IF EXISTS application_account_number_permanent ON accounts;
      CREATE TRIGGER application_account_number_permanent BEFORE UPDATE OF account_number ON accounts
        FOR EACH ROW EXECUTE FUNCTION protect_application_account_number();
      CREATE OR REPLACE FUNCTION capture_account_cash_change() RETURNS trigger AS $$
      BEGIN
        IF NEW.balance IS DISTINCT FROM OLD.balance THEN
          INSERT INTO account_cash_changes(account_id,transaction_xid,balance_before,balance_after)
            VALUES(NEW.id,txid_current(),OLD.balance,NEW.balance);
        END IF;
        RETURN NEW;
      END; $$ LANGUAGE plpgsql;
      DROP TRIGGER IF EXISTS capture_account_cash_change ON accounts;
      CREATE TRIGGER capture_account_cash_change AFTER UPDATE OF balance ON accounts
        FOR EACH ROW EXECUTE FUNCTION capture_account_cash_change();
      CREATE OR REPLACE FUNCTION record_cash_posting(tid INTEGER, aid INTEGER) RETURNS void AS $$
      DECLARE t transactions%ROWTYPE; change account_cash_changes%ROWTYPE; n INTEGER; delta NUMERIC;
      BEGIN
        SELECT * INTO STRICT t FROM transactions WHERE id=tid;
        IF t.status <> 'completed' THEN RAISE EXCEPTION 'Only actual completed postings can record balances'; END IF;
        SELECT COUNT(*) INTO n FROM account_cash_changes
          WHERE account_id=aid AND transaction_xid=txid_current() AND transaction_id IS NULL;
        IF n <> 1 THEN RAISE EXCEPTION 'Missing or ambiguous atomic cash posting evidence'; END IF;
        SELECT * INTO STRICT change FROM account_cash_changes
          WHERE account_id=aid AND transaction_xid=txid_current() AND transaction_id IS NULL FOR UPDATE;
        delta := CASE WHEN t.to_account_id=aid AND t.from_account_id IS DISTINCT FROM aid THEN t.amount
                      WHEN t.from_account_id=aid AND t.to_account_id IS DISTINCT FROM aid THEN -t.amount
                      ELSE NULL END;
        IF delta IS NULL OR change.balance_after-change.balance_before <> delta THEN
          RAISE EXCEPTION 'Cash posting does not match the transaction';
        END IF;
        UPDATE account_cash_changes SET transaction_id=tid WHERE id=change.id;
      END; $$ LANGUAGE plpgsql;
    `);
    await c.query("COMMIT");
  } catch (error) {
    await c.query("ROLLBACK");
    throw error;
  } finally { c.release(); }
}

/** The owner filter also protects the other side of cross-owner transactions. */
export async function ownedCashHistory(pool: Pool, userId: number, ledger: Transaction[], accountId?: number) {
  const { rows } = await pool.query(`
    SELECT p.transaction_id AS "transactionId",a.id AS "accountId",
      COALESCE(a.display_name,a.account_type) AS "accountName", a.account_number AS "accountNumber",
      p.balance_after::text AS "balanceAfter"
    FROM account_cash_changes p JOIN accounts a ON a.id=p.account_id
      JOIN transactions t ON t.id=p.transaction_id
    WHERE a.user_id=$1 AND t.status='completed'
      AND ($2::integer IS NULL OR a.id=$2)
    ORDER BY p.id`, [userId, accountId ?? null]);
  const byTransaction = new Map<number, typeof rows>();
  for (const { transactionId, ...posting } of rows) {
    const items = byTransaction.get(transactionId) ?? [];
    items.push(posting);
    byTransaction.set(transactionId, items);
  }
  return ledger.map(t => ({
    ...t,
    // Old generated descriptions exposed database keys. Keep stored history
    // intact, but never present those keys as customer account numbers.
    description: /^Transfer from Account #\d+ to Account #\d+$/.test(t.description ?? "")
      ? "Account transfer" : t.description,
    cashPostings: t.status === "completed" ? byTransaction.get(t.id) ?? [] : [],
  }));
}
