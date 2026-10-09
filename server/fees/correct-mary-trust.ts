import type { Pool } from "pg";
import { centsToMoney, moneyToCents } from "../../shared/fees";
import { maryOriginalAccounts } from "./fictional-history";

const MARKER = "fictional_legacy_trust_fees_corrected";
const REASON = "Historical dormant-account debt belongs to Brokerage only. Trust fees reversed at the user's direction; the newly funded inheritance Trust is separate.";

// Deliberate, atomic fixture correction only. Never called by startup or billing.
export async function correctMaryTrust(pool: Pool, apply = false) {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    await c.query("SELECT pg_advisory_xact_lock(7429,1)");
    const { user, accounts } = await maryOriginalAccounts(c);
    const trust = accounts.find(a => a.account_type === "Trust Account")!;
    const brokerage = accounts.find(a => a.account_type === "Brokerage Account")!;
    const { rows: inheritance } = await c.query(`SELECT a.id,a.balance FROM fee_audit f
      JOIN accounts a ON a.id=(f.detail->>'accountId')::integer
      WHERE f.actor='test_fixture' AND f.action='fictional_inheritance_account_created'
      AND f.detail->>'userId'=$1 AND f.detail->>'synthetic'='true'
      AND a.user_id=$2 AND a.is_demo=true AND a.account_type='Trust Account'`, [String(user.id),user.id]);
    if (inheritance.length !== 1) throw new Error("Expected the separate inheritance Trust; refusing correction");
    const { rows: markers } = await c.query("SELECT detail FROM fee_audit WHERE action=$1 AND detail->>'userId'=$2", [MARKER,String(user.id)]);
    if (markers.length > 1) throw new Error("Ambiguous correction provenance");
    if (markers.length) {
      await c.query("ROLLBACK");
      return { alreadyApplied:true, correction:markers[0].detail };
    }
    const { rows: assessments } = await c.query(`SELECT f.*,t.amount AS ledger_amount,t.from_account_id,
      t.transaction_type,t.status AS ledger_status,t.is_demo AS ledger_synthetic
      FROM fee_assessments f LEFT JOIN transactions t ON t.id=f.transaction_id
      WHERE f.account_id=$1 ORDER BY f.id FOR UPDATE OF f`,[trust.id]);
    const paid = assessments.filter(a=>a.status==="paid");
    const refund = paid.reduce((sum,a)=>sum+moneyToCents(a.total),0n);
    if (trust.balance !== "-12398.48" || brokerage.balance !== "-12398.48" ||
      refund !== 1239848n || assessments.length !== paid.length ||
      paid.some(a=>a.refund_transaction_id || a.from_account_id!==trust.id || a.ledger_amount!==a.total ||
        a.transaction_type!=="fee" || a.ledger_status!=="completed" || !a.ledger_synthetic)) {
      throw new Error("Historical balances or fees changed; review before correcting");
    }
    const detail = { synthetic:true,userId:user.id,trustAccountId:trust.id,brokerageAccountId:brokerage.id,
      inheritanceAccountId:inheritance[0].id,refund:centsToMoney(refund),before:trust.balance,
      after:"0.00",reason:REASON,inheritanceBalanceUnchanged:inheritance[0].balance,
      assessmentIds:paid.map(a=>a.id),refundTransactionIds:[] as number[],
      originalTransactionsPreserved:true,credentialsUnchanged:true,globalBillingSettingsUnchanged:true };
    if (!apply) {
      await c.query("ROLLBACK");
      return { alreadyApplied:false,correction:detail };
    }
    for (const assessment of paid) {
      const { rows:[t] } = await c.query(`INSERT INTO transactions(to_account_id,amount,description,transaction_type,status,is_demo)
        VALUES($1,$2,$3,'fee_refund','completed',true) RETURNING id`,
        [trust.id,assessment.total,`Historical Trust fee correction · Assessment ${assessment.id} · ${REASON}`]);
      await c.query("UPDATE fee_assessments SET status='refunded',reason=$2,refund_transaction_id=$3 WHERE id=$1",
        [assessment.id,REASON,t.id]);
      detail.refundTransactionIds.push(t.id);
      await c.query(`INSERT INTO fee_audit(actor,action,assessment_id,enrollment_id,contract_id,detail)
        VALUES('test_fixture','assessment_refunded',$1,$2,$3,$4::jsonb)`,
        [assessment.id,assessment.enrollment_id,assessment.contract_id,JSON.stringify({
          synthetic:true,reason:REASON,originalTransactionId:assessment.transaction_id,refundTransactionId:t.id,total:assessment.total })]);
    }
    await c.query("UPDATE accounts SET balance=balance+$2::numeric,display_name='Legacy Trust Account' WHERE id=$1", [trust.id,centsToMoney(refund)]);
    // Stop this legacy fixture from recreating a second dormant-account debt.
    await c.query("UPDATE fee_enrollments SET state='ended' WHERE account_id=$1", [trust.id]);
    await c.query("UPDATE management_contracts SET state='ended' WHERE account_id=$1", [trust.id]);
    const { rows:[ledger] } = await c.query(`SELECT COALESCE(SUM(CASE WHEN to_account_id=$1 THEN amount ELSE 0 END),0)
      -COALESCE(SUM(CASE WHEN from_account_id=$1 THEN amount ELSE 0 END),0) AS reconstructed
      FROM transactions WHERE status='completed' AND (from_account_id=$1 OR to_account_id=$1)`,[trust.id]);
    if (moneyToCents(ledger.reconstructed)!==0n) throw new Error("Corrected Trust ledger does not reconcile");
    await c.query("INSERT INTO fee_audit(actor,action,detail) VALUES('test_fixture',$1,$2::jsonb)",[MARKER,JSON.stringify(detail)]);
    await c.query("COMMIT");
    return { alreadyApplied:false,correction:detail };
  } catch (error) { await c.query("ROLLBACK"); throw error; }
  finally { c.release(); }
}
