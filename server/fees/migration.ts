import type { Pool } from "pg";
import { DEFAULT_FEE_COMPONENTS, DEFAULT_FEE_TERMS } from "../../shared/fees";

export async function initializeFeeTables(pool: Pool) {
  // New enum values must commit before they can be used in ledger inserts.
  await pool.query("ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'fee'");
  await pool.query("ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'fee_refund'");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(7429, 1)");
    await client.query(`
      CREATE TABLE IF NOT EXISTS fee_schedules (
        id SERIAL PRIMARY KEY, name TEXT NOT NULL, version INTEGER NOT NULL UNIQUE,
        currency TEXT NOT NULL DEFAULT 'CAD' CHECK (currency = 'CAD'),
        components JSONB NOT NULL CHECK (jsonb_array_length(components) = 3),
        total NUMERIC(14,2) NOT NULL CHECK (total > 0), terms TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS fee_enrollments (
        id SERIAL PRIMARY KEY, account_id INTEGER NOT NULL REFERENCES accounts(id),
        user_id INTEGER NOT NULL REFERENCES users(id), schedule_id INTEGER NOT NULL REFERENCES fee_schedules(id),
        state TEXT NOT NULL DEFAULT 'offered' CHECK (state IN ('offered','active','paused','ended')),
        first_charge_date TEXT NOT NULL, next_period INTEGER NOT NULL DEFAULT 0 CHECK (next_period >= 0),
        accepted_at TIMESTAMPTZ, accepted_by INTEGER REFERENCES users(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CHECK (state NOT IN ('active','paused') OR (accepted_at IS NOT NULL AND accepted_by = user_id))
      );
      CREATE UNIQUE INDEX IF NOT EXISTS fee_enrollments_current_idx ON fee_enrollments(account_id) WHERE state <> 'ended';
      CREATE TABLE IF NOT EXISTS fee_assessments (
        id SERIAL PRIMARY KEY, enrollment_id INTEGER NOT NULL REFERENCES fee_enrollments(id),
        account_id INTEGER NOT NULL REFERENCES accounts(id), period INTEGER NOT NULL CHECK (period >= 0),
        due_date TEXT NOT NULL, components JSONB NOT NULL, total NUMERIC(14,2) NOT NULL CHECK (total > 0),
        status TEXT NOT NULL CHECK (status IN ('paid','unpaid','skipped','refunded','waived')),
        reason TEXT, transaction_id INTEGER UNIQUE REFERENCES transactions(id),
        refund_transaction_id INTEGER UNIQUE REFERENCES transactions(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (enrollment_id, period),
        CHECK (status NOT IN ('paid','refunded') OR transaction_id IS NOT NULL),
        CHECK (status <> 'refunded' OR refund_transaction_id IS NOT NULL)
      );
      CREATE TABLE IF NOT EXISTS fee_audit (
        id SERIAL PRIMARY KEY, enrollment_id INTEGER REFERENCES fee_enrollments(id),
        assessment_id INTEGER REFERENCES fee_assessments(id), actor TEXT NOT NULL, action TEXT NOT NULL,
        detail JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS fee_settings (
        id INTEGER PRIMARY KEY CHECK (id = 1), enabled BOOLEAN NOT NULL DEFAULT FALSE,
        time_zone TEXT NOT NULL DEFAULT 'America/Toronto' CHECK (time_zone = 'America/Toronto')
      );
      INSERT INTO fee_settings (id) VALUES (1) ON CONFLICT DO NOTHING;
      CREATE OR REPLACE FUNCTION protect_fee_immutable() RETURNS trigger AS $$
      BEGIN RAISE EXCEPTION 'Fee schedules and audit entries are immutable'; END;
      $$ LANGUAGE plpgsql;
      DROP TRIGGER IF EXISTS fee_audit_immutable ON fee_audit;
      CREATE TRIGGER fee_audit_immutable BEFORE UPDATE OR DELETE ON fee_audit
        FOR EACH ROW EXECUTE FUNCTION protect_fee_immutable();
      DROP TRIGGER IF EXISTS fee_schedule_immutable ON fee_schedules;
      CREATE TRIGGER fee_schedule_immutable BEFORE UPDATE OR DELETE ON fee_schedules
        FOR EACH ROW EXECUTE FUNCTION protect_fee_immutable();
    `);
    await client.query(`INSERT INTO fee_schedules (name,version,components,total,terms)
      SELECT $1,1,$2::jsonb,'363.64',$3 WHERE NOT EXISTS (SELECT 1 FROM fee_schedules)`,
    ["Monthly service plan", JSON.stringify(DEFAULT_FEE_COMPONENTS), DEFAULT_FEE_TERMS]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}
