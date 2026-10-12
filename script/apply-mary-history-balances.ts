import pg from "pg";
import { fictionalBalanceInput } from "../server/fees/fictional-balances";
import { HistoricalBalanceService } from "../server/historical-balances";

// Manual, explicit fictional metadata operation. Never run at startup or publish.
const pool = new pg.Pool({
  connectionString: process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 15000,
});
async function financialSnapshot(userId: number) {
  const c = await pool.connect();
  try {
    await c.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const records: Record<string, unknown> = {};
    for (const [key,sql] of [
      ["accounts","SELECT * FROM accounts WHERE user_id=$1 ORDER BY id"],
      ["transactions","SELECT * FROM transactions WHERE from_account_id IN(SELECT id FROM accounts WHERE user_id=$1) OR to_account_id IN(SELECT id FROM accounts WHERE user_id=$1) ORDER BY id"],
      ["holdings","SELECT * FROM investments WHERE account_id IN(SELECT id FROM accounts WHERE user_id=$1) ORDER BY id"],
      ["enrollments","SELECT * FROM fee_enrollments WHERE user_id=$1 ORDER BY id"],
      ["contracts","SELECT * FROM management_contracts WHERE user_id=$1 ORDER BY id"],
      ["assessments","SELECT * FROM fee_assessments WHERE account_id IN(SELECT id FROM accounts WHERE user_id=$1) ORDER BY id"],
      ["cash","SELECT * FROM account_cash_changes WHERE account_id IN(SELECT id FROM accounts WHERE user_id=$1) ORDER BY id"],
      ["restrictions","SELECT id,display_currency,debt_clearance_required,debt_payment_account_id,debt_payment_confirmed_at,account_frozen,freeze_reason,frozen_at,login_restricted,login_restriction_message FROM users WHERE id=$1"],
      ["processing","SELECT * FROM fee_settings WHERE $1>0 ORDER BY id"],
    ]) records[key] = (await c.query(sql,[userId])).rows;
    await c.query("COMMIT");
    return JSON.stringify(records);
  } catch (error) { await c.query("ROLLBACK"); throw error; }
  finally { c.release(); }
}
async function main() {
  const apply = process.argv.includes("--apply-fictional-balances");
  if (apply && !process.argv.includes("--confirm-main-environment")) {
    throw new Error("Apply requires --confirm-main-environment after reviewing the exact preview");
  }
  const c = await pool.connect();
  let inputs;
  try {
    await c.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const { rows: [user] } = await c.query("SELECT id,name FROM users WHERE client_ref='VWMS2024'");
    if (!user || user.name !== "Mary Scott") throw new Error("Fictional owner missing or changed");
    const { rows: accounts } = await c.query("SELECT * FROM accounts WHERE user_id=$1 ORDER BY id", [user.id]);
    if (accounts.length !== 2 || accounts.some(a => !a.is_demo)) throw new Error("Unexpected fictional accounts");
    const { rows: provenance } = await c.query(`SELECT detail FROM fee_audit
      WHERE actor='test_fixture' AND action='fictional_inheritance_account_created'
      AND detail->>'synthetic'='true' AND detail->>'userId'=$1`, [String(user.id)]);
    if (provenance.length !== 1) throw new Error("Fictional inheritance provenance missing or ambiguous");
    const inheritance = provenance[0].detail;
    const trust = accounts.find(a => a.id === inheritance.accountId && a.account_type === "Trust Account");
    const brokerage = accounts.find(a => a.account_type === "Brokerage Account");
    if (!trust || !brokerage || inheritance.amount !== "1622886.00") throw new Error("Scenario changed");
    inputs = [];
    for (const [account, closing] of [[brokerage,"-12398.48"],[trust,"1622886.00"]] as const) {
      const { rows: transactions } = await c.query(`SELECT * FROM transactions
        WHERE from_account_id=$1 OR to_account_id=$1 ORDER BY created_at,id`, [account.id]);
      if (account.id === trust.id && (transactions.length !== 1 || transactions[0].id !== inheritance.transactionId)) {
        throw new Error("Inheritance history changed; review a new scenario");
      }
      inputs.push(fictionalBalanceInput(account, transactions, closing));
    }
    await c.query("COMMIT");
  } catch (error) { await c.query("ROLLBACK"); throw error; }
  finally { c.release(); }
  const before = await financialSnapshot(inputs[0].userId);
  // Demo flags historically defaulted true, so they are NOT sufficient consent.
  // Explicit source-specific audit authorization is required by the service.
  if (apply) for (const input of inputs) {
    await pool.query(`INSERT INTO fee_audit(actor,action,detail)
      SELECT 'test_fixture','fictional_balance_history_authorized',$1::jsonb
      WHERE NOT EXISTS (SELECT 1 FROM fee_audit WHERE actor='test_fixture'
        AND action='fictional_balance_history_authorized' AND detail->>'sourceSha256'=$2
        AND detail->>'accountId'=$3 AND detail->>'userId'=$4)`,
      [JSON.stringify({synthetic:true,userId:input.userId,accountId:input.accountId,sourceSha256:input.source.sha256,
        authorization:"Project owner explicitly confirmed fictional records and requested resulting balances reconciling to existing funds.",
        financialWrites:false}),input.source.sha256,String(input.accountId),String(input.userId)]);
  }
  const service = new HistoricalBalanceService(pool);
  const previews = [];
  for (const input of inputs) previews.push(await service.preview(input));
  console.log(JSON.stringify({ fictional: true, financialWrites: false, previews }, null, 2));
  if (apply && previews.some(p => !p.canApply)) throw new Error("Unresolved reconciliation conflicts; nothing applied");
  if (apply) for (const preview of previews) {
    console.log(JSON.stringify({accountId: preview.account.accountId, ...await service.apply(preview.previewId)}));
  }
  if (before !== await financialSnapshot(inputs[0].userId)) {
    throw new Error("Financial records changed during the operation; inspect concurrent activity");
  }
  console.log(JSON.stringify({financialRecordsUnchanged:true,credentialsWritten:false}));
}
main().catch(error => {
  console.error(error instanceof Error && !("code" in error) ? error.message : "Fictional history operation failed");
  process.exitCode = 1;
}).finally(() => pool.end());
