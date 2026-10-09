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
    await client.query("ALTER TABLE accounts ADD COLUMN IF NOT EXISTS display_name TEXT");
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
      ALTER TABLE fee_schedules ADD COLUMN IF NOT EXISTS funding TEXT NOT NULL DEFAULT 'cash_only'
        CHECK(funding IN ('cash_only','fee_overdraft'));
      CREATE TABLE IF NOT EXISTS management_contracts (
        id SERIAL PRIMARY KEY, account_id INTEGER NOT NULL REFERENCES accounts(id),
        user_id INTEGER NOT NULL REFERENCES users(id), opening_date TEXT NOT NULL,
        annual_minimum NUMERIC(14,2) NOT NULL CHECK(annual_minimum > 0),
        annual_rate_percent NUMERIC(5,2) NOT NULL CHECK(annual_rate_percent >= 0 AND annual_rate_percent <= 100),
        terms TEXT NOT NULL, funding TEXT NOT NULL DEFAULT 'fee_overdraft' CHECK(funding='fee_overdraft'),
        pricing_interaction TEXT NOT NULL DEFAULT 'additive' CHECK(pricing_interaction='additive'),
        state TEXT NOT NULL DEFAULT 'offered' CHECK(state IN ('offered','active','paused','ended')),
        next_period INTEGER NOT NULL DEFAULT 0 CHECK(next_period >= 0),
        accepted_at TIMESTAMPTZ, accepted_by INTEGER REFERENCES users(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CHECK(state NOT IN ('active','paused') OR (accepted_at IS NOT NULL AND accepted_by=user_id))
      );
      CREATE UNIQUE INDEX IF NOT EXISTS management_current_idx ON management_contracts(account_id) WHERE state<>'ended';
      CREATE TABLE IF NOT EXISTS management_valuations (
        id SERIAL PRIMARY KEY, contract_id INTEGER NOT NULL REFERENCES management_contracts(id),
        period INTEGER NOT NULL CHECK(period >= 0), valuation_date TEXT NOT NULL,
        aum NUMERIC(14,2) NOT NULL CHECK(aum >= 0), evidence TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(contract_id,period)
      );
      ALTER TABLE fee_assessments ALTER COLUMN enrollment_id DROP NOT NULL;
      ALTER TABLE fee_assessments ADD COLUMN IF NOT EXISTS contract_id INTEGER REFERENCES management_contracts(id);
      ALTER TABLE fee_assessments ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'monthly' CHECK(kind IN ('monthly','management'));
      ALTER TABLE fee_assessments ADD COLUMN IF NOT EXISTS funding TEXT NOT NULL DEFAULT 'cash_only' CHECK(funding IN ('cash_only','fee_overdraft'));
      ALTER TABLE fee_assessments ADD COLUMN IF NOT EXISTS calculation JSONB NOT NULL DEFAULT '{}';
      CREATE UNIQUE INDEX IF NOT EXISTS management_assessment_period_idx ON fee_assessments(contract_id,period) WHERE contract_id IS NOT NULL;
      DO $$ BEGIN
        ALTER TABLE fee_assessments ADD CONSTRAINT fee_assessment_owner CHECK(
          (kind='monthly' AND enrollment_id IS NOT NULL AND contract_id IS NULL) OR
          (kind='management' AND contract_id IS NOT NULL AND enrollment_id IS NULL));
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
      ALTER TABLE fee_audit ADD COLUMN IF NOT EXISTS contract_id INTEGER REFERENCES management_contracts(id);
      CREATE OR REPLACE FUNCTION protect_fee_immutable() RETURNS trigger AS $$
      BEGIN RAISE EXCEPTION 'Fee schedules and audit entries are immutable'; END;
      $$ LANGUAGE plpgsql;
      DROP TRIGGER IF EXISTS fee_audit_immutable ON fee_audit;
      CREATE TRIGGER fee_audit_immutable BEFORE UPDATE OR DELETE ON fee_audit
        FOR EACH ROW EXECUTE FUNCTION protect_fee_immutable();
      DROP TRIGGER IF EXISTS fee_schedule_immutable ON fee_schedules;
      CREATE TRIGGER fee_schedule_immutable BEFORE UPDATE OR DELETE ON fee_schedules
        FOR EACH ROW EXECUTE FUNCTION protect_fee_immutable();
      DROP TRIGGER IF EXISTS management_valuation_immutable ON management_valuations;
      CREATE TRIGGER management_valuation_immutable BEFORE UPDATE OR DELETE ON management_valuations
        FOR EACH ROW EXECUTE FUNCTION protect_fee_immutable();
      CREATE OR REPLACE FUNCTION protect_management_terms() RETURNS trigger AS $$
      BEGIN
        IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Management contract history is immutable'; END IF;
        IF (NEW.account_id,NEW.user_id,NEW.opening_date,NEW.annual_minimum,NEW.annual_rate_percent,
            NEW.terms,NEW.funding,NEW.pricing_interaction,NEW.created_at) IS DISTINCT FROM
           (OLD.account_id,OLD.user_id,OLD.opening_date,OLD.annual_minimum,OLD.annual_rate_percent,
            OLD.terms,OLD.funding,OLD.pricing_interaction,OLD.created_at) THEN
          RAISE EXCEPTION 'Management contract terms are immutable';
        END IF;
        RETURN NEW;
      END; $$ LANGUAGE plpgsql;
      DROP TRIGGER IF EXISTS management_terms_immutable ON management_contracts;
      CREATE TRIGGER management_terms_immutable BEFORE UPDATE OR DELETE ON management_contracts
        FOR EACH ROW EXECUTE FUNCTION protect_management_terms();
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
