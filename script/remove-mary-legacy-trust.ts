import assert from "node:assert/strict";
import { pool } from "../server/db";

// Explicit, owner-authorized synthetic-record cleanup. Never call at startup.
if (!process.argv.includes("--apply")) throw new Error("Explicit --apply is required");
const client = await pool.connect();
try {
  await client.query("BEGIN");
  await client.query(`ALTER TABLE users
    ADD COLUMN IF NOT EXISTS debt_clearance_required BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS debt_payment_account_id INTEGER,
    ADD COLUMN IF NOT EXISTS debt_payment_confirmed_at TIMESTAMP`);
  const { rows: owners } = await client.query("SELECT id FROM users WHERE client_ref=$1 AND name=$2 FOR UPDATE",["VWMS2024","Mary Scott"]);
  assert.equal(owners.length,1,"Expected exactly one fictional owner");
  const ownerId = owners[0].id;
  const { rows: owned } = await client.query("SELECT * FROM accounts WHERE user_id=$1 ORDER BY id FOR UPDATE",[ownerId]);
  assert(owned.length >= 2 && owned.every(a => a.is_demo === true),"Cleanup is restricted to synthetic accounts");
  const legacy = owned.find(a => a.display_name === "Legacy Trust Account");
  const brokerage = owned.find(a => a.account_type === "Brokerage Account");
  const inheritance = owned.find(a => a.display_name === "Inheritance Trust Account");
  assert(brokerage && inheritance,"Preserved accounts must exist");
  if (!legacy) {
    const { rows: marker } = await client.query("SELECT id FROM fee_audit WHERE action='fictional_legacy_trust_deleted' AND detail->>'userId'=$1",[String(ownerId)]);
    assert(marker.length === 1,"Missing cleanup authorization marker");
    await client.query("ROLLBACK");
    console.log("Previously completed cleanup verified; no records changed.");
  } else {
    assert.equal(Number(legacy.balance),0,"Legacy cash must be empty");
    assert.equal(brokerage.balance,"-12398.48","Unexpected Brokerage balance; stop rather than overwrite");
    assert.equal(inheritance.balance,"1622886.00","Unexpected inheritance balance");
    const { rows: txns } = await client.query("SELECT * FROM transactions WHERE from_account_id=$1 OR to_account_id=$1 ORDER BY id FOR UPDATE",[legacy.id]);
    const shared = txns.filter(t => (t.from_account_id && t.from_account_id !== legacy.id) || (t.to_account_id && t.to_account_id !== legacy.id));
    assert.equal(shared.length,1,"Unexpected shared history");
    assert.equal(shared[0].to_account_id,brokerage.id);
    assert.equal(shared[0].from_account_id,legacy.id);
    assert.equal(shared[0].amount,"60769.50","Opening credit must remain intact");
    const removedTransactions = txns.filter(t => t.id !== shared[0].id).map(t => t.id);
    const ids = async (table: string, column: string, values: number[]) =>
      (await client.query(`SELECT id FROM ${table} WHERE ${column}=ANY($1::int[])`,[values])).rows.map(r => r.id) as number[];
    const enrollments = await ids("fee_enrollments","account_id",[legacy.id]);
    const assessments = await ids("fee_assessments","account_id",[legacy.id]);
    const contracts = await ids("management_contracts","account_id",[legacy.id]);
    const valuations = await ids("management_valuations","contract_id",contracts);
    const investments = await ids("investments","account_id",[legacy.id]);
    function referencesLegacy(value: unknown, accountContext = false, allowName = false): boolean {
      if (typeof value === "string") return (allowName && value.includes("Legacy Trust Account")) || (accountContext && value === String(legacy.id));
      if (typeof value === "number") return accountContext && value === legacy.id;
      if (Array.isArray(value)) return value.some(item => referencesLegacy(item,accountContext,allowName));
      if (value && typeof value === "object") return Object.entries(value).some(([key,item]) =>
        referencesLegacy(item,accountContext || /(?:account_?ids?|trust_?ids?)$/i.test(key),allowName));
      return false;
    }
    const { rows: audit } = await client.query("SELECT id,enrollment_id,assessment_id,contract_id,detail FROM fee_audit");
    const audits = audit.filter(a => enrollments.includes(a.enrollment_id) || assessments.includes(a.assessment_id) ||
      contracts.includes(a.contract_id) || referencesLegacy(a.detail,false,String(a.detail?.userId) === String(ownerId))).map(a => a.id);
    const excluded: Record<string,number[]> = { accounts:[legacy.id],transactions:removedTransactions,
      investments,fee_enrollments:enrollments,fee_assessments:assessments,management_contracts:contracts,
      management_valuations:valuations,fee_audit:audits,fee_schedules:[],institutional_transfers:[],payees:[] };
    async function snapshots() {
      const result: Record<string,string> = {};
      for (const [table, excludedIds] of Object.entries(excluded)) {
        // Shared opening credit is allowed exactly one change: its retired source is removed.
        const row = table === "transactions"
          ? `CASE WHEN id=${shared[0].id} THEN to_jsonb(t)-'from_account_id' ELSE to_jsonb(t) END`
          : "to_jsonb(t)";
        result[table] = (await client.query(`SELECT md5(COALESCE(jsonb_agg(${row} ORDER BY id)::text,'[]')) AS hash
          FROM ${table} t WHERE NOT(id=ANY($1::int[]))`,[excludedIds])).rows[0].hash;
      }
      result.users = (await client.query(`SELECT md5(jsonb_agg(
        CASE WHEN id=$1 THEN to_jsonb(u)-ARRAY['debt_clearance_required','debt_payment_account_id','debt_payment_confirmed_at']
        ELSE to_jsonb(u) END ORDER BY id)::text) AS hash FROM users u`,[ownerId])).rows[0].hash;
      return result;
    }
    const before = await snapshots();
    // These three immutable tables contain this fictional fixture's linked history.
    // DDL takes exclusive locks; restoration and deletions commit/rollback together.
    await client.query("ALTER TABLE fee_audit DISABLE TRIGGER fee_audit_immutable");
    await client.query("ALTER TABLE management_valuations DISABLE TRIGGER management_valuation_immutable");
    await client.query("ALTER TABLE management_contracts DISABLE TRIGGER management_terms_immutable");
    for (const table of ["fee_audit","fee_assessments","management_valuations","management_contracts","fee_enrollments","investments"]) {
      await client.query(`DELETE FROM ${table} WHERE id=ANY($1::int[])`,[excluded[table]]);
    }
    await client.query("UPDATE transactions SET from_account_id=NULL WHERE id=$1",[shared[0].id]);
    await client.query("DELETE FROM transactions WHERE id=ANY($1::int[])",[removedTransactions]);
    await client.query("DELETE FROM accounts WHERE id=$1",[legacy.id]);
    await client.query(`UPDATE users SET debt_clearance_required=TRUE,debt_payment_account_id=$2,
      debt_payment_confirmed_at=NULL WHERE id=$1`,[ownerId,brokerage.id]);
    await client.query("ALTER TABLE fee_audit ENABLE TRIGGER fee_audit_immutable");
    await client.query("ALTER TABLE management_valuations ENABLE TRIGGER management_valuation_immutable");
    await client.query("ALTER TABLE management_contracts ENABLE TRIGGER management_terms_immutable");
    assert.deepEqual(await snapshots(),before,"Unrelated records or preserved balances changed");
    const { rows: remaining } = await client.query("SELECT count(*)::int AS count FROM transactions WHERE from_account_id=$1 OR to_account_id=$1",[legacy.id]);
    assert.equal(remaining[0].count,0);
    await client.query(`INSERT INTO fee_audit(actor,action,detail) VALUES ('owner_authorized_fixture_cleanup','fictional_legacy_trust_deleted',$1::jsonb)`,
      [JSON.stringify({userId:ownerId,removedTransactionCount:removedTransactions.length,
        sharedOpeningCreditPreserved:true,source:"Explicit owner approval; separate verified repayment required"})]);
    await client.query("COMMIT");
    console.log(JSON.stringify({removedLegacyAccount:true,removedTransactions:removedTransactions.length,
      openingCreditPreserved:true,brokerageDebt:"12398.48",inheritanceBalance:"1622886.00",
      unrelatedRecordsUnchanged:true,paymentRecorded:false,fundsLocked:true}));
  }
} catch {
  await client.query("ROLLBACK");
  console.error("Cleanup stopped and rolled back. No partial deletion or payment was applied.");
  process.exitCode=1;
} finally { client.release(); await pool.end(); }
