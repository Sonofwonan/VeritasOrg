import assert from "node:assert/strict";
import type { Pool, PoolClient } from "pg";
import {
  annualDate, billingToday, centsToMoney, DEFAULT_FEE_COMPONENTS, MANAGEMENT_TERMS,
  moneyToCents, OVERDRAFT_FEE_TERMS, periodDate,
} from "../../shared/fees";

const FIRST_FEE = "2024-03-01";
const OPENING = "2024-01-01";
const MARKER = "fictional_overdraft_history_applied";

export async function maryOriginalAccounts(c: PoolClient) {
  const { rows: [user] } = await c.query("SELECT id,name FROM users WHERE client_ref='VWMS2024'");
  if (!user || user.name !== "Mary Scott") throw new Error("The existing fictional Mary Scott profile was not found");
  const { rows: provenance } = await c.query(`SELECT e.account_id FROM fee_audit f JOIN fee_enrollments e ON e.id=f.enrollment_id WHERE f.actor='test_fixture'
    AND action='fictional_fixture_created' AND detail->>'fixture'='mary-scott-history'
    AND detail->>'synthetic'='true' AND enrollment_id IN (SELECT id FROM fee_enrollments WHERE user_id=$1)`,[user.id]);
  if (provenance.length !== 1) throw new Error("Fictional provenance is missing or ambiguous; refusing to modify records");
  const { rows: allAccounts } = await c.query("SELECT * FROM accounts WHERE user_id=$1 ORDER BY id FOR UPDATE",[user.id]);
  const trustId = provenance[0].account_id;
  const { rows: allocations } = await c.query(`SELECT DISTINCT to_account_id FROM transactions
    WHERE from_account_id=$1 AND amount=60769.50 AND transaction_type='transfer' AND status='completed' AND is_demo=true`, [trustId]);
  if (allocations.length !== 1) throw new Error("Original fixture allocation provenance is missing or ambiguous");
  const accounts = allAccounts.filter(a => a.id === trustId || a.id === allocations[0].to_account_id);
  if (accounts.length !== 2 || accounts.some(a => !a.is_demo) ||
    !accounts.some(a => a.account_type === "Trust Account") || !accounts.some(a => a.account_type === "Brokerage Account")) {
    throw new Error("Expected exactly the two internally marked fictional accounts");
  }
  for (const extra of allAccounts.filter(a => !accounts.some(original => original.id === a.id))) {
    const { rows: markers } = await c.query(`SELECT id FROM fee_audit WHERE actor='test_fixture'
      AND action='fictional_inheritance_account_created' AND detail->>'synthetic'='true'
      AND detail->>'userId'=$1 AND detail->>'accountId'=$2`, [String(user.id),String(extra.id)]);
    if (markers.length !== 1 || !extra.is_demo || extra.account_type !== "Trust Account") {
      throw new Error("Additional account lacks recognized fictional provenance; refusing history changes");
    }
  }
  return { user, accounts };
}

export async function previewMaryHistory(pool: Pool, now = new Date()) {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    const { user, accounts } = await maryOriginalAccounts(c);
    const { rows: [existing] } = await c.query("SELECT detail FROM fee_audit WHERE action=$1 AND detail->>'userId'=$2",[MARKER,String(user.id)]);
    const today = billingToday(now);
    let months = 0, years = 0;
    while (periodDate(FIRST_FEE,months) <= today) months++;
    while (years < 2 && annualDate(OPENING,years) <= today) years++;
    const monthly = centsToMoney(36364n * BigInt(months));
    const management = centsToMoney(38100n * BigInt(years));
    return { alreadyApplied: Boolean(existing), dueThrough: today, monthlyThrough: periodDate(FIRST_FEE,months-1),
      months, annualDates: Array.from({length:years},(_,p) => annualDate(OPENING,p)), annualMinimum:"381.00",
      annualRatePercent:"1.70", pricingInteraction:"additive", accounts: accounts.map(a => ({
        accountId:a.id, accountType:a.account_type, before:a.balance, monthlyFees:monthly, managementFees:management,
        proposedBalance: existing ? a.balance : centsToMoney(moneyToCents(a.balance)-moneyToCents(monthly)-moneyToCents(management)),
      })), originalAdjustment: existing?.detail ?? null };
  } finally { await c.query("ROLLBACK"); c.release(); }
}

// Deliberate fixture-only operation. Never called from server startup, migrations or jobs.
// The immutable audit record captures user-authorized synthetic terms, not real-client consent.
export async function applyMaryHistory(pool: Pool, now = new Date()) {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    await c.query("SELECT pg_advisory_xact_lock(7429,1)");
    const { user, accounts } = await maryOriginalAccounts(c);
    const { rows: [existing] } = await c.query("SELECT detail FROM fee_audit WHERE action=$1 AND detail->>'userId'=$2",[MARKER,String(user.id)]);
    if (existing) {
      await c.query("COMMIT");
      return { alreadyApplied:true, adjustment:existing.detail, accounts:accounts.map(a => ({accountId:a.id,balance:a.balance})) };
    }
    if (accounts.some(a => moneyToCents(a.balance) !== 0n)) throw new Error("Fixture cash changed; review a new before/after proposal before applying");
    const { rows: holdings } = await c.query("SELECT id FROM investments WHERE account_id=ANY($1::integer[]) AND shares<>0",[accounts.map(a => a.id)]);
    if (holdings.length) throw new Error("Fixture has holdings; minimum-only synthetic annual history is no longer applicable");
    const { rows: ledger } = await c.query(`SELECT a.id,COUNT(t.id)::integer AS entries,
      COALESCE(SUM(CASE WHEN t.to_account_id=a.id THEN t.amount ELSE 0 END),0)
      - COALESCE(SUM(CASE WHEN t.from_account_id=a.id THEN t.amount ELSE 0 END),0) AS reconstructed,
      BOOL_OR(t.transaction_type='buy' OR t.status<>'completed' OR NOT t.is_demo) AS unexpected
      FROM accounts a LEFT JOIN transactions t ON t.from_account_id=a.id OR t.to_account_id=a.id
       WHERE a.id=ANY($1::integer[]) GROUP BY a.id`,[accounts.map(a => a.id)]);
    for (const a of ledger) {
      const expectedEntries = accounts.find(account => account.id === a.id)?.account_type === "Trust Account" ? 4 : 3;
      if (moneyToCents(a.reconstructed) !== 0n || a.entries !== expectedEntries || a.unexpected) throw new Error("Original fixture ledger changed; refusing to overwrite or infer history");
    }
    const { rows: contracts } = await c.query("SELECT id FROM management_contracts WHERE account_id=ANY($1::integer[])",[accounts.map(a => a.id)]);
    if (contracts.length) throw new Error("A management contract already exists; review before adding fictional history");
    const { rows: plans } = await c.query(`SELECT e.*,s.total,s.components,s.funding FROM fee_enrollments e
      JOIN fee_schedules s ON s.id=e.schedule_id WHERE e.account_id=ANY($1::integer[]) FOR UPDATE OF e`,[accounts.map(a => a.id)]);
    if (plans.length !== 1 || plans[0].state !== "paused" || plans[0].funding !== "cash_only" ||
      plans[0].first_charge_date !== FIRST_FEE || plans[0].total !== "363.64" ||
      accounts.find(a => a.id === plans[0].account_id)?.account_type !== "Trust Account") {
      throw new Error("Original paused Trust-only fixture enrollment changed");
    }
    const { rows: originals } = await c.query("SELECT * FROM fee_assessments WHERE enrollment_id=$1 ORDER BY period FOR UPDATE",[plans[0].id]);
    for (const [i,a] of originals.entries()) {
      if (a.period !== i || a.status !== "unpaid" || a.transaction_id || a.total !== "363.64" || a.due_date !== periodDate(FIRST_FEE,i)) {
        throw new Error("Existing Trust assessments changed");
      }
    }
    const today = billingToday(now);
    let months = 0, years = 0;
    while (periodDate(FIRST_FEE,months) <= today) months++;
    while (years < 2 && annualDate(OPENING,years) <= today) years++;
    if (originals.length > months) throw new Error("Fixture contains future assessments");
    const { rows: [schedule] } = await c.query(`INSERT INTO fee_schedules(name,version,components,total,terms,funding)
      SELECT 'Authorized per-account fee overdraft',COALESCE(MAX(version),0)+1,$1::jsonb,'363.64',$2,'fee_overdraft'
      FROM fee_schedules RETURNING *`,[JSON.stringify(DEFAULT_FEE_COMPONENTS),OVERDRAFT_FEE_TERMS]);
    await c.query("UPDATE fee_enrollments SET state='ended' WHERE id=$1",[plans[0].id]);
    await c.query(`INSERT INTO fee_audit(enrollment_id,actor,action,detail) VALUES($1,'test_fixture','fictional_cash_only_plan_replaced',$2::jsonb)`,
      [plans[0].id,JSON.stringify({synthetic:true,originalTermsUnchanged:true,newScheduleId:schedule.id,
        authorization:"User explicitly authorized fictional per-account overdraft history; not actual customer consent."})]);
    const accountResults = [];
    for (const account of accounts) {
      const { rows: [e] } = await c.query(`INSERT INTO fee_enrollments(account_id,user_id,schedule_id,state,first_charge_date,next_period,accepted_at,accepted_by)
        VALUES($1,$2,$3,'active',$4,$5,$6,$2) RETURNING *`,[account.id,user.id,schedule.id,FIRST_FEE,months,`${OPENING}T14:00:00Z`]);
      const post = async (a: any) => {
        const { rows: [t] } = await c.query(`INSERT INTO transactions(from_account_id,amount,description,transaction_type,status,is_demo,created_at)
          VALUES($1,$2,$3,'fee','completed',true,$4) RETURNING id`,[account.id,a.total,
          `CAD ${a.kind === "management" ? "annual discretionary-management fee" : "monthly service fee"} · ${a.due_date} · Assessment ${a.id} · Authorized fee overdraft`,`${a.due_date}T14:00:00Z`]);
        await c.query("UPDATE accounts SET balance=balance-$2::numeric WHERE id=$1",[account.id,a.total]);
        await c.query(`UPDATE fee_assessments SET status='paid',funding='fee_overdraft',transaction_id=$2,
          reason='Authorized fee-overdraft history adjustment',
          calculation=calculation || $3::jsonb WHERE id=$1`,[a.id,t.id,JSON.stringify({synthetic:true,authorizedScheduleId:schedule.id,originalUnpaidAssessment:a.enrollment_id === plans[0].id})]);
        await c.query(`INSERT INTO fee_audit(actor,action,detail,enrollment_id,assessment_id,contract_id)
          VALUES('test_fixture','fictional_assessment_posted',$1::jsonb,$2,$3,$4)`,
        [JSON.stringify({synthetic:true,previousStatus:a.status,total:a.total,transactionId:t.id,
          dueDate:a.due_date,funding:"fee_overdraft",authorizedScheduleId:schedule.id}),a.enrollment_id,a.id,a.contract_id ?? null]);
      };
      for (let p=0;p<months;p++) {
        let a = account.id === plans[0].account_id ? originals[p] : undefined;
        if (!a) {
          const result = await c.query(`INSERT INTO fee_assessments(enrollment_id,account_id,period,due_date,components,total,status,funding)
            VALUES($1,$2,$3,$4,$5::jsonb,'363.64','unpaid','fee_overdraft') RETURNING *`,
          [e.id,account.id,p,periodDate(FIRST_FEE,p),JSON.stringify(DEFAULT_FEE_COMPONENTS)]);
          a = result.rows[0];
        }
        await post(a);
      }
      const { rows: [m] } = await c.query(`INSERT INTO management_contracts(account_id,user_id,opening_date,annual_minimum,annual_rate_percent,terms,
        state,next_period,accepted_at,accepted_by) VALUES($1,$2,$3,'381.00','1.70',$4,'active',$5,$6,$2) RETURNING *`,
      [account.id,user.id,OPENING,MANAGEMENT_TERMS,years,`${OPENING}T14:00:00Z`]);
      await c.query(`INSERT INTO fee_audit(actor,action,detail,contract_id) VALUES('test_fixture','fictional_management_authorized',$1::jsonb,$2)`,
      [JSON.stringify({synthetic:true,annualMinimum:"381.00",annualRatePercent:"1.70",pricingInteraction:"additive",openingDate:OPENING,
        authorization:"User explicitly authorized Jan 1 2025 and Jan 1 2026 fictional minimum-only history on both accounts; not evidence of actual customer consent."}),m.id]);
      for (let p=0;p<years;p++) {
        const due = annualDate(OPENING,p);
        const { rows: [v] } = await c.query(`INSERT INTO management_valuations(contract_id,period,valuation_date,aum,evidence)
          VALUES($1,$2,$3,0,$4) RETURNING *`,[m.id,p,due,
          "Explicitly authorized fictional zero-holdings anniversary fixture. Opening/depletion ledger retained; no historical market valuations claimed."]);
        const calculation = {synthetic:true,coverageStart:periodDate(OPENING,p*12),coverageEnd:due,valuationDate:due,valuationId:v.id,
          aum:"0.00",annualMinimum:"381.00",annualRatePercent:"1.70",pricingInteraction:"additive",
          convention:"End-of-period holdings, excluding cash and fee debt",
          formula:"max(AUM × annual percentage, annual minimum)",rounding:"Half-up to cents"};
        const { rows: [a] } = await c.query(`INSERT INTO fee_assessments(contract_id,account_id,period,due_date,components,total,status,kind,funding,calculation)
          VALUES($1,$2,$3,$4,$5::jsonb,'381.00','unpaid','management','fee_overdraft',$6::jsonb) RETURNING *`,
        [m.id,account.id,p,due,JSON.stringify([{name:"Discretionary management annual minimum",amount:"381.00",serviceDescription:"Annual minimum at fictional zero holdings; additional to monthly service fees."}]),JSON.stringify(calculation)]);
        await post(a);
      }
      const expected = -(36364n*BigInt(months)+38100n*BigInt(years));
      const { rows: [reconciled] } = await c.query(`SELECT a.balance,
        COALESCE((SELECT SUM(amount) FROM transactions WHERE to_account_id=a.id),0)
        -COALESCE((SELECT SUM(amount) FROM transactions WHERE from_account_id=a.id),0) AS reconstructed FROM accounts a WHERE id=$1`,[account.id]);
      assert.equal(moneyToCents(reconciled.balance),expected);
      assert.equal(moneyToCents(reconciled.reconstructed),expected);
      accountResults.push({accountId:account.id,accountType:account.account_type,balance:reconciled.balance,
        monthlyFees:centsToMoney(36364n*BigInt(months)),managementFees:centsToMoney(38100n*BigInt(years))});
    }
    const adjustment = {synthetic:true,userId:user.id,appliedThrough:today,months,annualDates:Array.from({length:years},(_,p)=>annualDate(OPENING,p)),
      accounts:accountResults,originalAssessmentsConverted:originals.length,credentialsUnchanged:true,
      originalLedgerPreserved:true,globalProcessingSettingsUnchanged:true};
    await c.query(`INSERT INTO fee_audit(actor,action,detail) VALUES('test_fixture',$1,$2::jsonb)`,[MARKER,JSON.stringify(adjustment)]);
    await c.query("COMMIT");
    return {alreadyApplied:false,adjustment,accounts:accountResults};
  } catch (error) { await c.query("ROLLBACK"); throw error; }
  finally { c.release(); }
}
