import type { Pool, PoolClient } from "pg";
import { billingToday, DEFAULT_FEE_COMPONENTS, OVERDRAFT_FEE_TERMS } from "../../shared/fees";
import { maryOriginalAccounts } from "./fictional-history";

export const INHERITANCE = {
  amount: "1622886.00", date: "2026-10-08",
  // Noon Toronto (EDT) on the approved date. Stored as an unambiguous UTC instant.
  timestamp: "2026-10-08T16:00:00Z",
  description: "Inheritance — family farm sale proceeds",
  displayName: "Inheritance Trust Account",
  firstChargeDate: "2026-11-08", monthlyFee: "363.64",
} as const;
const MARKER = "fictional_inheritance_account_created";

async function existing(c: PoolClient, userId: number) {
  const { rows } = await c.query(`SELECT detail FROM fee_audit WHERE actor='test_fixture' AND action=$1
    AND detail->>'userId'=$2 AND detail->>'synthetic'='true'`, [MARKER,String(userId)]);
  if (rows.length > 1) throw new Error("Ambiguous inheritance provenance");
  if (!rows.length) return null;
  const detail = rows[0].detail;
  const { rows: [a] } = await c.query("SELECT id,user_id,account_type,is_demo,balance FROM accounts WHERE id=$1", [detail.accountId]);
  const { rows: [t] } = await c.query("SELECT * FROM transactions WHERE id=$1", [detail.transactionId]);
  const { rows: [e] } = await c.query(`SELECT e.*,s.total,s.funding FROM fee_enrollments e JOIN fee_schedules s ON s.id=e.schedule_id WHERE e.id=$1`, [detail.enrollmentId]);
  if (!a || a.user_id !== userId || a.account_type !== "Trust Account" || !a.is_demo ||
    !t || t.to_account_id !== a.id || t.from_account_id !== null || t.amount !== INHERITANCE.amount ||
    t.status !== "completed" || !t.is_demo || t.transaction_type !== "transfer" ||
    t.description !== INHERITANCE.description || new Date(t.created_at).toISOString() !== new Date(INHERITANCE.timestamp).toISOString() ||
    !e || e.user_id !== userId || e.account_id !== a.id || e.first_charge_date !== INHERITANCE.firstChargeDate ||
    e.total !== INHERITANCE.monthlyFee || e.funding !== "fee_overdraft") {
    throw new Error("Inheritance records changed or are missing; refusing to recreate or overwrite them");
  }
  return { ...detail, currentBalance: a.balance };
}

// Explicit fixture operation only; never called by startup, migrations, deployment or jobs.
export async function inheritanceAccount(pool: Pool, apply = false, now = new Date()) {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    await c.query("SELECT pg_advisory_xact_lock(7429,1)");
    const { user, accounts } = await maryOriginalAccounts(c);
    const prior = await existing(c,user.id);
    if (prior) {
      await c.query("ROLLBACK");
      return { alreadyApplied: true, account: prior };
    }
    const today = billingToday(now);
    if (today < INHERITANCE.date || today >= INHERITANCE.firstChargeDate) {
      throw new Error("Review the prospective fee date before applying outside the approved opening period");
    }
    const { rows: [settings] } = await c.query("SELECT enabled FROM fee_settings WHERE id=1");
    if (!apply) {
      await c.query("ROLLBACK");
      return { alreadyApplied: false, owner: user.name, ...INHERITANCE,
        existingAccounts: accounts.map(a => ({ accountId:a.id, balance:a.balance })),
        globalProcessingEnabled: settings.enabled,
        managementContract: "Not enrolled: no separate discretionary-management eligibility authorization",
      };
    }
    const { rows: [account] } = await c.query(`INSERT INTO accounts(user_id,account_type,display_name,balance,is_demo,created_at)
      VALUES($1,'Trust Account',$2,$3,true,$4) RETURNING id,balance`,
      [user.id,INHERITANCE.displayName,INHERITANCE.amount,INHERITANCE.timestamp]);
    const { rows: [transaction] } = await c.query(`INSERT INTO transactions(to_account_id,amount,description,transaction_type,status,is_demo,created_at)
      VALUES($1,$2,$3,'transfer','completed',true,$4) RETURNING id`,
      [account.id,INHERITANCE.amount,INHERITANCE.description,INHERITANCE.timestamp]);
    let { rows: [schedule] } = await c.query(`SELECT id FROM fee_schedules
      WHERE currency='CAD' AND total=363.64 AND funding='fee_overdraft' AND terms=$1 AND components=$2::jsonb
      ORDER BY version DESC LIMIT 1`, [OVERDRAFT_FEE_TERMS,JSON.stringify(DEFAULT_FEE_COMPONENTS)]);
    if (!schedule) {
      const result = await c.query(`INSERT INTO fee_schedules(name,version,components,total,terms,funding)
        SELECT 'Authorized per-account fee overdraft',COALESCE(MAX(version),0)+1,$1::jsonb,'363.64',$2,'fee_overdraft'
        FROM fee_schedules RETURNING id`, [JSON.stringify(DEFAULT_FEE_COMPONENTS),OVERDRAFT_FEE_TERMS]);
      schedule = result.rows[0];
    }
    const { rows: [enrollment] } = await c.query(`INSERT INTO fee_enrollments(account_id,user_id,schedule_id,state,first_charge_date,accepted_at,accepted_by)
      VALUES($1,$2,$3,'active',$4,$5,$2) RETURNING id`,
      [account.id,user.id,schedule.id,INHERITANCE.firstChargeDate,now]);
    const detail = { synthetic:true, userId:user.id, accountId:account.id, transactionId:transaction.id,
      enrollmentId:enrollment.id, ...INHERITANCE, currentBalance:account.balance,
      authorization:"User authorized this fictional inheritance deposit and standing per-account monthly fees; not evidence of actual client consent or external settlement.",
      originalAccountsUnchanged:true, credentialsUnchanged:true, globalProcessingSettingsUnchanged:true,
      managementEnrolled:false };
    await c.query(`INSERT INTO fee_audit(enrollment_id,actor,action,detail)
      VALUES($1,'test_fixture',$2,$3::jsonb)`, [enrollment.id,MARKER,JSON.stringify(detail)]);
    await c.query("COMMIT");
    return { alreadyApplied:false, account:detail };
  } catch (error) { await c.query("ROLLBACK"); throw error; }
  finally { c.release(); }
}
