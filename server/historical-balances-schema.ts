import type { Pool } from "pg";

/** Evidence metadata only. No balances, transactions, contracts or billing are written. */
export async function initializeHistoricalBalances(pool: Pool) {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    await c.query("SELECT pg_advisory_xact_lock(7429,58)");
    await c.query(`
      CREATE TABLE IF NOT EXISTS historical_balance_previews (
        id UUID PRIMARY KEY,
        account_id INTEGER NOT NULL REFERENCES accounts(id),
        input JSONB NOT NULL,
        fingerprint TEXT NOT NULL,
        snapshot_hash TEXT NOT NULL,
        result JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
      );
      CREATE TABLE IF NOT EXISTS historical_balance_imports (
        id UUID PRIMARY KEY,
        preview_id UUID NOT NULL UNIQUE REFERENCES historical_balance_previews(id),
        account_id INTEGER NOT NULL REFERENCES accounts(id),
        user_id INTEGER NOT NULL REFERENCES users(id),
        start_at TIMESTAMPTZ NOT NULL,
        end_at TIMESTAMPTZ NOT NULL CHECK (end_at > start_at),
        opening_balance NUMERIC NOT NULL,
        closing_balance NUMERIC NOT NULL,
        fingerprint TEXT NOT NULL UNIQUE,
        source JSONB NOT NULL,
        posting_count INTEGER NOT NULL,
        actor TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
      );
      CREATE INDEX IF NOT EXISTS historical_balance_imports_account_idx
        ON historical_balance_imports(account_id,start_at,end_at);
      CREATE TABLE IF NOT EXISTS historical_balance_postings (
        id BIGSERIAL PRIMARY KEY,
        import_id UUID NOT NULL REFERENCES historical_balance_imports(id),
        account_id INTEGER NOT NULL REFERENCES accounts(id),
        transaction_id INTEGER REFERENCES transactions(id),
        source_sequence INTEGER NOT NULL,
        occurred_at TIMESTAMPTZ NOT NULL,
        delta NUMERIC NOT NULL,
        balance_after NUMERIC NOT NULL,
        source_reference TEXT NOT NULL,
        kind TEXT NOT NULL,
        related_transaction_id INTEGER REFERENCES transactions(id),
        UNIQUE(import_id,source_sequence),
        UNIQUE(account_id,transaction_id)
      );
      CREATE OR REPLACE FUNCTION protect_historical_balance_evidence() RETURNS trigger AS $$
      BEGIN
        RAISE EXCEPTION 'Historical balance evidence is immutable';
      END; $$ LANGUAGE plpgsql;
      CREATE TABLE IF NOT EXISTS transaction_date_corrections (
        id BIGSERIAL PRIMARY KEY,
        transaction_id INTEGER NOT NULL UNIQUE REFERENCES transactions(id),
        account_id INTEGER NOT NULL REFERENCES accounts(id),
        user_id INTEGER NOT NULL REFERENCES users(id),
        original_at TIMESTAMPTZ NOT NULL,
        effective_at TIMESTAMPTZ NOT NULL CHECK (effective_at <> original_at),
        historical_import_id UUID NOT NULL REFERENCES historical_balance_imports(id),
        original_fingerprint TEXT NOT NULL,
        authorization_detail JSONB NOT NULL CHECK (authorization_detail->>'synthetic' IS NOT NULL AND authorization_detail->>'synthetic'='true'),
        created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
      );
      DROP TRIGGER IF EXISTS transaction_date_corrections_immutable ON transaction_date_corrections;
      CREATE TRIGGER transaction_date_corrections_immutable
        BEFORE UPDATE OR DELETE ON transaction_date_corrections
        FOR EACH ROW EXECUTE FUNCTION protect_historical_balance_evidence();
      DROP TRIGGER IF EXISTS historical_balance_imports_immutable ON historical_balance_imports;
      CREATE TRIGGER historical_balance_imports_immutable
        BEFORE UPDATE OR DELETE ON historical_balance_imports
        FOR EACH ROW EXECUTE FUNCTION protect_historical_balance_evidence();
      DROP TRIGGER IF EXISTS historical_balance_postings_immutable ON historical_balance_postings;
      CREATE TRIGGER historical_balance_postings_immutable
        BEFORE UPDATE OR DELETE ON historical_balance_postings
        FOR EACH ROW EXECUTE FUNCTION protect_historical_balance_evidence();
      DROP TRIGGER IF EXISTS historical_balance_previews_immutable ON historical_balance_previews;
      CREATE TRIGGER historical_balance_previews_immutable
        BEFORE UPDATE OR DELETE ON historical_balance_previews
        FOR EACH ROW EXECUTE FUNCTION protect_historical_balance_evidence();
    `);
    await c.query("COMMIT");
  } catch (error) {
    await c.query("ROLLBACK");
    throw error;
  } finally { c.release(); }
}
