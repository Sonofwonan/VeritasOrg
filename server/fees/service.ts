import type { Pool, PoolClient } from "pg";
import { createHash } from "node:crypto";
import {
  BILLING_TIME_ZONE, billingToday, centsToMoney, feeAcceptanceInput, feeOfferInput, feeScheduleInput,
  availableCashCents, firstPeriodOnOrAfter, moneyToCents, periodDate, validateBillingDate,
  annualDate, managementFee, managementOfferInput, managementValuationInput,
  type ClientFees, type ClientFeeSummary, type FeeAssessment, type FeeEnrollment, type FeeOverview, type FeePreview,
  type ManagementContract,
} from "../../shared/fees";

export class FeeError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
const camel = (row: Record<string, any>) => Object.fromEntries(
  Object.entries(row).map(([key, value]) => [
    key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase()),
    value instanceof Date ? value.toISOString() : value,
  ]),
);
type EnrollmentRow = {
  id: number; account_id: number; user_id: number; schedule_id: number; state: string;
  first_charge_date: string; next_period: number; accepted_at: Date | null;
};
type ContractRow = EnrollmentRow & { opening_date: string; annual_minimum: string; annual_rate_percent: string };
// Preserve fractional-cent ledger precision when reporting current debt.
function exactAdd(a: string, b: string): string {
  if (![a,b].every(v => /^-?\d+(\.\d+)?$/.test(v))) throw new FeeError("Cash ledger balance is not a finite decimal",409);
  const scale = Math.max(2, ...[a,b].map(v => v.split(".")[1]?.length || 0));
  const units = (v: string) => {
    const [whole, fraction=""] = v.replace(/^-/,"").split(".");
    return (v.startsWith("-") ? -1n : 1n) * BigInt(whole + fraction.padEnd(scale,"0"));
  };
  const n = units(a)+units(b), abs = (n < 0n ? -n : n).toString().padStart(scale+1,"0");
  return `${n < 0n ? "-" : ""}${abs.slice(0,-scale)}.${abs.slice(-scale)}`;
}

export class FeeService {
  constructor(private pool: Pool, private now: () => Date = () => new Date()) {}
  private today() { return billingToday(this.now()); }
  private async atomic<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      // Shared by settings, enrollment changes, jobs, retries, waivers and refunds across instances.
      await client.query("SELECT pg_advisory_xact_lock(7429, 1)");
      const result = await work(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK"); throw error;
    } finally { client.release(); }
  }
  private async audit(c: PoolClient, actor: string, action: string, detail: unknown, enrollmentId?: number, assessmentId?: number, contractId?: number) {
    await c.query(`INSERT INTO fee_audit(actor,action,detail,enrollment_id,assessment_id,contract_id) VALUES($1,$2,$3::jsonb,$4,$5,$6)`,
      [actor, action, JSON.stringify(detail), enrollmentId ?? null, assessmentId ?? null, contractId ?? null]);
  }
  private async enrollment(c: PoolClient, id: number, userId?: number): Promise<EnrollmentRow> {
    const { rows: [row] } = await c.query("SELECT * FROM fee_enrollments WHERE id=$1 FOR UPDATE", [id]);
    if (!row || (userId !== undefined && row.user_id !== userId)) throw new FeeError("Enrollment not found", 404);
    return row;
  }
  private async enabled(c: PoolClient) {
    const { rows: [s] } = await c.query("SELECT enabled FROM fee_settings WHERE id=1");
    if (!s?.enabled) throw new FeeError("Fee processing is disabled");
  }
  private async enrollments(userId?: number, accountId?: number): Promise<FeeEnrollment[]> {
    const { rows } = await this.pool.query(`SELECT e.*, row_to_json(s.*)::jsonb || jsonb_build_object('total',s.total::text) AS schedule, a.account_type AS account_name,
      u.name AS user_name FROM fee_enrollments e JOIN fee_schedules s ON s.id=e.schedule_id
      JOIN accounts a ON a.id=e.account_id JOIN users u ON u.id=e.user_id
      WHERE ($1::integer IS NULL OR e.user_id=$1) AND ($2::integer IS NULL OR e.account_id=$2)
      ORDER BY e.id DESC`, [userId ?? null, accountId ?? null]);
    return rows.map(row => ({
      ...camel(row), schedule: camel(row.schedule),
      nextChargeDate: row.state === "active" ? periodDate(row.first_charge_date, row.next_period) : null,
    }) as FeeEnrollment);
  }
  private async contracts(userId?: number, accountId?: number): Promise<ManagementContract[]> {
    const { rows } = await this.pool.query(`SELECT m.*,a.account_type AS account_name,u.name AS user_name
      FROM management_contracts m JOIN accounts a ON a.id=m.account_id JOIN users u ON u.id=m.user_id
      WHERE ($1::integer IS NULL OR m.user_id=$1) AND ($2::integer IS NULL OR m.account_id=$2) ORDER BY m.id DESC`,
    [userId ?? null, accountId ?? null]);
    return rows.map(row => ({ ...camel(row), nextChargeDate: row.state === "active" ? annualDate(row.opening_date, row.next_period) : null })) as ManagementContract[];
  }
  async overview(): Promise<FeeOverview> {
    const [settings, schedules, enrollments, assessments, audit, accounts, contracts, valuations] = await Promise.all([
      this.pool.query("SELECT enabled,time_zone FROM fee_settings WHERE id=1"),
      this.pool.query("SELECT * FROM fee_schedules ORDER BY version DESC"),
      this.enrollments(),
      this.pool.query("SELECT * FROM fee_assessments ORDER BY id DESC LIMIT 500"),
      this.pool.query("SELECT * FROM fee_audit ORDER BY id DESC LIMIT 100"),
      this.pool.query("SELECT a.*,u.name AS user_name FROM accounts a JOIN users u ON u.id=a.user_id ORDER BY a.id"),
      this.contracts(),
      this.pool.query("SELECT * FROM management_valuations ORDER BY id DESC"),
    ]);
    return { settings: camel(settings.rows[0]), schedules: schedules.rows.map(camel),
      enrollments, assessments: assessments.rows.map(camel), audit: audit.rows.map(camel),
      accounts: accounts.rows.map(camel), contracts, valuations: valuations.rows.map(camel) } as FeeOverview;
  }
  async clientView(userId: number, accountId: number): Promise<ClientFees> {
    const { rows } = await this.pool.query("SELECT id,balance FROM accounts WHERE id=$1 AND user_id=$2", [accountId, userId]);
    if (!rows.length) throw new FeeError("Account not found", 404);
    const [enrollments, assessments, settings, contracts, valuations] = await Promise.all([
      this.enrollments(userId, accountId),
      this.pool.query(`SELECT f.* FROM fee_assessments f JOIN accounts a ON a.id=f.account_id
        WHERE a.user_id=$1 AND a.id=$2 ORDER BY f.due_date DESC,f.id DESC`, [userId, accountId]),
      this.pool.query("SELECT enabled,time_zone FROM fee_settings WHERE id=1"),
      this.contracts(userId, accountId),
      this.pool.query(`SELECT v.* FROM management_valuations v JOIN management_contracts m ON m.id=v.contract_id
        WHERE m.user_id=$1 AND m.account_id=$2 ORDER BY v.id DESC`, [userId, accountId]),
    ]);
    return { enrollments, assessments: assessments.rows.map(camel), settings: camel(settings.rows[0]), contracts,
      valuations: valuations.rows.map(camel), balance: rows[0].balance } as ClientFees;
  }
  async clientSummary(userId: number): Promise<ClientFeeSummary> {
    // Include all unpaid periods, even for paused/ended plans. Paid fees already
    // reduced cash; waived/refunded/skipped assessments are not liabilities.
    const { rows } = await this.pool.query(`SELECT a.id AS account_id,
      COALESCE(SUM(f.total) FILTER (WHERE f.status='unpaid'),0)::text AS unpaid_total,
      COUNT(f.id) FILTER (WHERE f.status='unpaid')::integer AS unpaid_count
      ,GREATEST(-a.balance,0)::text AS overdraft
      FROM accounts a LEFT JOIN fee_assessments f ON f.account_id=a.id
      WHERE a.user_id=$1 GROUP BY a.id ORDER BY a.id`, [userId]);
    const accounts = rows.map(row => ({
      accountId: row.account_id, unpaidTotal: centsToMoney(moneyToCents(row.unpaid_total)), unpaidCount: row.unpaid_count,
      overdraft: row.overdraft,
      amountOwed: exactAdd(row.overdraft, row.unpaid_total),
    }));
    return {
      accounts,
      totalUnpaid: centsToMoney(accounts.reduce((sum, account) => sum + moneyToCents(account.unpaidTotal), 0n)),
      totalOverdraft: accounts.reduce((sum, account) => exactAdd(sum, account.overdraft), "0.00"),
      totalOwed: accounts.reduce((sum, account) => exactAdd(sum, account.amountOwed), "0.00"),
    };
  }
  async createSchedule(input: unknown) {
    const data = feeScheduleInput.parse(input);
    if (data.funding === "fee_overdraft" && (!/authoriz(?:e|ation)[^.]*overdraft/i.test(data.terms) ||
      /\bno\b[^.]*\boverdraft\b/i.test(data.terms))) throw new FeeError("Overdraft terms must explicitly authorize overdrafts and must not retain cash-only/no-overdraft language");
    const total = data.components.reduce((sum, item) => sum + moneyToCents(item.amount), 0n);
    if (total <= 0n || data.components.some(item => moneyToCents(item.amount) <= 0n)) throw new FeeError("All three service fees must be positive");
    const components = data.components.map(item => ({ ...item, amount: centsToMoney(moneyToCents(item.amount)) }));
    return this.atomic(async c => {
      const { rows: [row] } = await c.query(`INSERT INTO fee_schedules(name,version,components,total,terms,funding)
        SELECT $1,COALESCE(MAX(version),0)+1,$2::jsonb,$3,$4,$5 FROM fee_schedules RETURNING *`,
        [data.name, JSON.stringify(components), centsToMoney(total), data.terms, data.funding]);
      await this.audit(c, "admin", "schedule_created", { scheduleId: row.id, version: row.version, total: row.total, currency: "CAD" });
      return camel(row);
    });
  }
  async offer(input: unknown) {
    const data = feeOfferInput.parse(input);
    if (!validateBillingDate(data.firstChargeDate) || data.firstChargeDate <= this.today()) throw new FeeError("First charge date must be a future Toronto calendar date");
    return this.atomic(async c => {
      const { rows: [account] } = await c.query("SELECT * FROM accounts WHERE id=$1 FOR UPDATE", [data.accountId]);
      if (!account) throw new FeeError("Account not found", 404);
      const { rows: [schedule] } = await c.query("SELECT id FROM fee_schedules WHERE id=$1", [data.scheduleId]);
      if (!schedule) throw new FeeError("Schedule not found", 404);
      const { rows: existing } = await c.query("SELECT id FROM fee_enrollments WHERE account_id=$1 AND state<>'ended'", [data.accountId]);
      if (existing.length) throw new FeeError("End the existing enrollment before offering a new version", 409);
      const { rows: assessedPeriods } = await c.query(`SELECT e.first_charge_date,a.period
        FROM fee_assessments a JOIN fee_enrollments e ON e.id=a.enrollment_id WHERE a.account_id=$1`, [data.accountId]);
      const earliest = assessedPeriods.reduce((latest, a) => {
        const end = periodDate(a.first_charge_date, a.period + 1);
        return end > latest ? end : latest;
      }, "");
      if (earliest && data.firstChargeDate < earliest) throw new FeeError(`An existing assessed monthly period runs until ${earliest}. Choose that date or later to avoid overlapping charges.`, 409);
      const { rows: [row] } = await c.query(`INSERT INTO fee_enrollments(account_id,user_id,schedule_id,first_charge_date)
        VALUES($1,$2,$3,$4) RETURNING *`, [account.id, account.user_id, data.scheduleId, data.firstChargeDate]);
      await this.audit(c, "admin", "plan_offered", { scheduleId: data.scheduleId, firstChargeDate: data.firstChargeDate, servicesConfirmed: true }, row.id);
      return camel(row);
    });
  }
  async accept(userId: number, id: number, input: unknown) {
    const data = feeAcceptanceInput.parse(input);
    return this.atomic(async c => {
      const e = await this.enrollment(c, id, userId);
      if (e.state !== "offered" || data.scheduleId !== e.schedule_id) throw new FeeError("The offered schedule is no longer available", 409);
      if (e.first_charge_date < this.today()) throw new FeeError("The first charge date has passed. Request a new offer.");
      const { rows: [row] } = await c.query(`UPDATE fee_enrollments SET state='active',accepted_at=$2,accepted_by=$3 WHERE id=$1 RETURNING *`,
        [id, this.now(), userId]);
      await this.audit(c, `client:${userId}`, "plan_accepted", { scheduleId: e.schedule_id, firstChargeDate: e.first_charge_date, currency: "CAD", debitAuthorized: true }, id);
      return camel(row);
    });
  }
  async changeState(id: number, state: "active" | "paused" | "ended", userId?: number) {
    return this.atomic(async c => {
      const e = await this.enrollment(c, id, userId);
      if (userId !== undefined && state !== "ended") throw new FeeError("Clients may only end enrollment", 403);
      if (e.state === "ended") throw new FeeError("Enrollment already ended", 409);
      if (state === "active" && e.state !== "paused") throw new FeeError("Only a client-accepted paused plan can resume");
      if (state === "paused" && e.state !== "active") throw new FeeError("Only an active plan can be paused");
      const nextPeriod = state === "active" ? Math.max(e.next_period, firstPeriodOnOrAfter(e.first_charge_date, this.today())) : e.next_period;
      const { rows: [row] } = await c.query("UPDATE fee_enrollments SET state=$2,next_period=$3 WHERE id=$1 RETURNING *", [id, state, nextPeriod]);
      await this.audit(c, userId === undefined ? "admin" : `client:${userId}`, `enrollment_${state}`, { previousState: e.state, nextPeriod }, id);
      return camel(row);
    });
  }
  async settings(enabled: boolean) {
    return this.atomic(async c => {
      await c.query("UPDATE fee_settings SET enabled=$1 WHERE id=1", [enabled]);
      await this.audit(c, "admin", "processing_settings", { enabled });
      return { enabled, timeZone: BILLING_TIME_ZONE };
    });
  }
  private async managementContract(c: PoolClient, id: number, userId?: number): Promise<ContractRow> {
    const { rows: [m] } = await c.query("SELECT * FROM management_contracts WHERE id=$1 FOR UPDATE", [id]);
    if (!m || (userId !== undefined && m.user_id !== userId)) throw new FeeError("Management contract not found",404);
    return m;
  }
  async offerManagement(input: unknown) {
    const data = managementOfferInput.parse(input);
    if (!validateBillingDate(data.openingDate) || data.openingDate <= this.today()) throw new FeeError("Management opening date must be a future Toronto calendar date");
    if (moneyToCents(data.annualMinimum) <= 0n) throw new FeeError("Annual minimum must be positive");
    if (!/authoriz(?:e|ation)[^.]*overdraft/i.test(data.terms) || /\bno\b[^.]*\boverdraft\b/i.test(data.terms) ||
      !/additional/i.test(data.terms)) throw new FeeError("Management terms must disclose overdraft authorization and additional annual pricing without contradictory no-overdraft language");
    return this.atomic(async c => {
      const { rows: [account] } = await c.query("SELECT * FROM accounts WHERE id=$1 FOR UPDATE", [data.accountId]);
      if (!account) throw new FeeError("Account not found",404);
      const { rows: current } = await c.query("SELECT id FROM management_contracts WHERE account_id=$1 AND state<>'ended'", [data.accountId]);
      if (current.length) throw new FeeError("End the existing management contract before offering another",409);
      const { rows: covered } = await c.query(`SELECT m.opening_date,f.period FROM fee_assessments f
        JOIN management_contracts m ON m.id=f.contract_id WHERE f.account_id=$1`, [data.accountId]);
      const lastEnd = covered.reduce((end,row) => {
        const date = annualDate(row.opening_date,row.period);
        return date > end ? date : end;
      },"");
      if (data.openingDate < lastEnd) throw new FeeError(`Annual management coverage overlaps; choose ${lastEnd} or later`,409);
      const { rows: [m] } = await c.query(`INSERT INTO management_contracts(account_id,user_id,opening_date,annual_minimum,annual_rate_percent,terms)
        VALUES($1,$2,$3,$4,$5,$6) RETURNING *`, [account.id,account.user_id,data.openingDate,data.annualMinimum,data.annualRatePercent,data.terms]);
      await this.audit(c,"admin","management_offered",{...data,firstChargeDate:annualDate(data.openingDate,0),pricingInteraction:"additive"},undefined,undefined,m.id);
      return camel(m);
    });
  }
  async acceptManagement(userId: number, id: number, input: unknown) {
    if (!input || Object.keys(input as object).length !== 1 || (input as any).accepted !== true) throw new FeeError("Explicit acceptance of this exact management contract is required");
    return this.atomic(async c => {
      const m = await this.managementContract(c,id,userId);
      if (m.state !== "offered") throw new FeeError("Management offer is no longer available",409);
      if (m.opening_date < this.today()) throw new FeeError("Management opening date has passed. Request a new offer.");
      const { rows: [row] } = await c.query("UPDATE management_contracts SET state='active',accepted_at=$2,accepted_by=$3 WHERE id=$1 RETURNING *",[id,this.now(),userId]);
      await this.audit(c,`client:${userId}`,"management_accepted",{annualMinimum:m.annual_minimum,annualRatePercent:m.annual_rate_percent,
        openingDate:m.opening_date,funding:"fee_overdraft",pricingInteraction:"additive"},undefined,undefined,id);
      return camel(row);
    });
  }
  async managementState(id: number, state: "active" | "paused" | "ended", userId?: number) {
    return this.atomic(async c => {
      const m = await this.managementContract(c,id,userId);
      if (userId !== undefined && state !== "ended") throw new FeeError("Clients may only end management contracts",403);
      if (m.state === "ended") throw new FeeError("Management contract already ended",409);
      if (state === "active" && m.state !== "paused") throw new FeeError("Only an accepted paused management contract can resume");
      if (state === "paused" && m.state !== "active") throw new FeeError("Only an active management contract can pause");
      let next = m.next_period;
      if (state === "active") while (annualDate(m.opening_date,next) < this.today()) next++;
      const { rows: [row] } = await c.query("UPDATE management_contracts SET state=$2,next_period=$3 WHERE id=$1 RETURNING *",[id,state,next]);
      await this.audit(c,userId === undefined ? "admin" : `client:${userId}`,`management_${state}`,{previousState:m.state,nextPeriod:next},undefined,undefined,id);
      return camel(row);
    });
  }
  async recordValuation(id: number, input: unknown) {
    const data = managementValuationInput.parse(input);
    return this.atomic(async c => {
      const m = await this.managementContract(c,id);
      if (!["active","paused"].includes(m.state)) throw new FeeError("An accepted, open management contract is required");
      const date = annualDate(m.opening_date,data.period);
      if (date > this.today()) throw new FeeError("Future anniversary valuations cannot be recorded");
      const { rows: existing } = await c.query("SELECT id FROM management_valuations WHERE contract_id=$1 AND period=$2",[id,data.period]);
      if (existing.length) throw new FeeError("This annual valuation is already recorded and immutable",409);
      const { rows: [v] } = await c.query(`INSERT INTO management_valuations(contract_id,period,valuation_date,aum,evidence)
        VALUES($1,$2,$3,$4,$5) RETURNING *`,[id,data.period,date,data.aum,data.evidence]);
      await this.audit(c,"admin","management_valuation_recorded",{...data,valuationDate:date,valuationId:v.id,convention:"End-of-period holdings, excluding cash and debt"},undefined,undefined,id);
      return camel(v);
    });
  }
  private async annualValuation(source: Pool | PoolClient, m: ContractRow, p: number, persist = false) {
    if (persist) {
      // Serialize the observed holdings with investment purchases/sales on this account.
      await source.query("SELECT id FROM users WHERE id=$1 FOR UPDATE",[m.user_id]);
      await source.query("SELECT id FROM accounts WHERE id=$1 AND user_id=$2 FOR UPDATE",[m.account_id,m.user_id]);
    }
    const { rows: [existing] } = await source.query("SELECT * FROM management_valuations WHERE contract_id=$1 AND period=$2",[m.id,p]);
    if (existing) return existing;
    const date = annualDate(m.opening_date,p);
    // Today's empty holdings can be observed, but cannot prove a previous date's AUM.
    if (date !== this.today()) return null;
    const { rows: [holdings] } = await source.query("SELECT COUNT(*)::integer AS n FROM investments WHERE account_id=$1 AND shares<>0",[m.account_id]);
    if (holdings.n !== 0) return null;
    const evidence = "Empty holdings ledger observed on the billing anniversary; excludes cash and fee debt.";
    if (!persist) return {id:null,aum:"0.00",valuation_date:date,evidence};
    const { rows: [v] } = await source.query(`INSERT INTO management_valuations(contract_id,period,valuation_date,aum,evidence)
      VALUES($1,$2,$3,0,$4) RETURNING *`,[m.id,p,date,evidence]);
    await this.audit(source as PoolClient,"scheduler","management_zero_holdings_snapshot",{valuationId:v.id,valuationDate:date,aum:"0.00"},undefined,undefined,m.id);
    return v;
  }
  private async lockedReason(c: PoolClient, e: EnrollmentRow): Promise<string | null> {
    const { rows: [u] } = await c.query("SELECT account_frozen FROM users WHERE id=$1 FOR UPDATE", [e.user_id]);
    if (!u || u.account_frozen) return "Account is frozen";
    const { rows } = await c.query(`SELECT id FROM institutional_transfers WHERE user_id=$1
      AND status IN ('approved','liquidating','transfer_out')`, [e.user_id]);
    return rows.length ? "Account is locked by an institutional transfer" : null;
  }
  async preview(connection?: PoolClient): Promise<FeePreview> {
    const source = connection || this.pool;
    const { rows: [settings] } = await source.query("SELECT enabled FROM fee_settings WHERE id=1");
    const { rows } = await source.query(`SELECT e.*,s.total,s.funding,a.balance,u.name AS user_name,u.account_frozen,
      EXISTS(SELECT 1 FROM institutional_transfers t WHERE t.user_id=e.user_id AND t.status IN ('approved','liquidating','transfer_out')) AS transfer_locked
      FROM fee_enrollments e JOIN fee_schedules s ON s.id=e.schedule_id JOIN accounts a ON a.id=e.account_id
      JOIN users u ON u.id=e.user_id WHERE e.state='active' ORDER BY e.id`);
    const charges: FeePreview["charges"] = [];
    for (const e of rows) {
      let balance = availableCashCents(e.balance);
      let p = e.next_period;
      for (let n = 0; n < 120 && periodDate(e.first_charge_date, p) <= this.today(); n++, p++) {
        const reason = e.account_frozen ? "Account is frozen" : e.transfer_locked ? "Account is locked by an institutional transfer"
          : balance === null ? "Cash ledger balance is not a finite decimal"
          : e.funding !== "fee_overdraft" && balance < moneyToCents(e.total) ? "Insufficient available cash" : null;
        const outcome = e.account_frozen || e.transfer_locked || balance === null ? "skipped" : reason ? "unpaid" : "payable";
        if (outcome === "payable" && balance !== null) balance -= moneyToCents(e.total);
        charges.push({ enrollmentId: e.id, kind: "monthly", funding: e.funding, accountId: e.account_id, userName: e.user_name, period: p, dueDate: periodDate(e.first_charge_date, p), total: e.total, outcome, reason });
      }
    }
    const { rows: contracts } = await source.query(`SELECT m.*,a.balance,u.name AS user_name,u.account_frozen,
      EXISTS(SELECT 1 FROM institutional_transfers t WHERE t.user_id=m.user_id AND t.status IN ('approved','liquidating','transfer_out')) AS transfer_locked
      FROM management_contracts m JOIN accounts a ON a.id=m.account_id JOIN users u ON u.id=m.user_id
      WHERE m.state='active' ORDER BY m.id`);
    for (const m of contracts) {
      for (let p = m.next_period, n = 0; n < 120 && annualDate(m.opening_date,p) <= this.today(); n++, p++) {
        const v = await this.annualValuation(source,m,p);
        const reason = m.account_frozen ? "Account is frozen" : m.transfer_locked ? "Account is locked by an institutional transfer"
          : availableCashCents(m.balance) === null ? "Cash ledger balance is not a finite decimal"
          : !v ? "Documented anniversary holdings valuation required; no charge will post" : null;
        charges.push({ enrollmentId: null, contractId: m.id, kind: "management", funding: "fee_overdraft",
          accountId: m.account_id, userName: m.user_name, period: p, dueDate: annualDate(m.opening_date,p),
          total: v ? managementFee(v.aum,m.annual_rate_percent,m.annual_minimum) : m.annual_minimum, outcome: reason ? "skipped" : "payable", reason });
        if (!v) break;
      }
    }
    const result = { enabled: settings.enabled, timeZone: BILLING_TIME_ZONE, today: this.today(), charges };
    return { ...result, previewToken: createHash("sha256").update(JSON.stringify(result)).digest("hex") };
  }
  private async settle(c: PoolClient, e: EnrollmentRow, assessment: any, actor: string): Promise<FeeAssessment> {
    // Enrollment is already locked by the common billing advisory lock.
    let reason = await this.lockedReason(c, e);
    const { rows: [account] } = await c.query("SELECT * FROM accounts WHERE id=$1 FOR UPDATE", [e.account_id]);
    if (!account || account.user_id !== e.user_id) throw new FeeError("Billing account unavailable", 409);
    if (availableCashCents(account.balance) === null) reason ||= "Cash ledger balance is not a finite decimal";
    let status = reason ? "skipped" : "unpaid";
    let message = reason || "Insufficient available cash";
    let transactionId: number | null = null;
    if (!reason) {
      // Recheck balance in the actual UPDATE; never debit based on a stale read.
      const result = await c.query(`UPDATE accounts SET balance=balance-$2::numeric WHERE id=$1 AND ($3::boolean OR balance >= $2::numeric) RETURNING id`,
        [e.account_id, assessment.total, assessment.funding === "fee_overdraft"]);
      if (result.rows.length) {
        const { rows: [transaction] } = await c.query(`INSERT INTO transactions(from_account_id,amount,description,transaction_type,status,is_demo)
          VALUES($1,$2,$3,'fee','completed',false) RETURNING id`,
          [e.account_id, assessment.total, `CAD ${assessment.kind === "management" ? "annual discretionary-management fee" : "monthly service fee"} · ${assessment.due_date} · Assessment ${assessment.id} · ${assessment.funding === "fee_overdraft" ? "Authorized fee overdraft" : "Available cash"}`]);
        transactionId = transaction.id; status = "paid"; message = "";
      }
    }
    const { rows: [row] } = await c.query(`UPDATE fee_assessments SET status=$2,reason=$3,transaction_id=$4 WHERE id=$1 RETURNING *`,
      [assessment.id, status, message || null, transactionId]);
    await this.audit(c, actor, `assessment_${status}`, { total: row.total, reason: row.reason, transactionId, funding: assessment.funding, kind: assessment.kind },
      assessment.enrollment_id ?? undefined, row.id, assessment.contract_id ?? undefined);
    return camel(row) as FeeAssessment;
  }
  async run(actor = "admin", previewToken?: string) {
    return this.atomic(async c => {
      await this.enabled(c);
      if (previewToken && (await this.preview(c)).previewToken !== previewToken) throw new FeeError("The preview has changed. Refresh it and review the current charges before running.", 409);
      const { rows: enrollments } = await c.query("SELECT * FROM fee_enrollments WHERE state='active' ORDER BY id FOR UPDATE");
      const results: FeeAssessment[] = [];
      for (const e of enrollments as EnrollmentRow[]) {
        const { rows: [schedule] } = await c.query("SELECT * FROM fee_schedules WHERE id=$1", [e.schedule_id]);
        if (!e.accepted_at || e.first_charge_date < billingToday(e.accepted_at)) throw new FeeError("Invalid billing authorization", 409);
        let p = e.next_period;
        for (let n = 0; n < 120 && periodDate(e.first_charge_date, p) <= this.today(); n++, p++) {
          const { rows: [assessment] } = await c.query(`INSERT INTO fee_assessments(enrollment_id,account_id,period,due_date,components,total,status,funding)
            VALUES($1,$2,$3,$4,$5::jsonb,$6,'unpaid',$7) ON CONFLICT(enrollment_id,period) DO NOTHING RETURNING *`,
            [e.id, e.account_id, p, periodDate(e.first_charge_date, p), JSON.stringify(schedule.components), schedule.total, schedule.funding]);
          if (assessment) results.push(await this.settle(c, e, assessment, actor));
        }
        await c.query("UPDATE fee_enrollments SET next_period=$2 WHERE id=$1", [e.id, p]);
      }
      const { rows: contracts } = await c.query("SELECT * FROM management_contracts WHERE state='active' ORDER BY id FOR UPDATE");
      for (const m of contracts) {
        if (!m.accepted_at || m.opening_date < billingToday(m.accepted_at)) throw new FeeError("Invalid management authorization", 409);
        let p = m.next_period;
        for (let n = 0; n < 120 && annualDate(m.opening_date,p) <= this.today(); n++, p++) {
          const v = await this.annualValuation(c,m,p,true);
          if (!v) break; // Never fabricate historical AUM or advance an unvalued period.
          const total = managementFee(v.aum,m.annual_rate_percent,m.annual_minimum);
          const calculation = { coverageStart: periodDate(m.opening_date,p*12), coverageEnd: annualDate(m.opening_date,p),
            valuationDate: v.valuation_date, valuationId: v.id, aum: v.aum, annualRatePercent: m.annual_rate_percent,
            annualMinimum: m.annual_minimum, convention: "End-of-period holdings, excluding cash and fee debt",
            pricingInteraction: "additive", rounding: "Half-up to cents", formula: "max(AUM × annual percentage, annual minimum)" };
          const components = [{name:"Discretionary management",amount:total,serviceDescription:"Annual AUM fee or annual minimum, whichever is greater; additional to monthly service fees."}];
          const { rows: [a] } = await c.query(`INSERT INTO fee_assessments(contract_id,account_id,period,due_date,components,total,status,kind,funding,calculation)
            VALUES($1,$2,$3,$4,$5::jsonb,$6,'unpaid','management','fee_overdraft',$7::jsonb)
            ON CONFLICT DO NOTHING RETURNING *`, [m.id,m.account_id,p,annualDate(m.opening_date,p),JSON.stringify(components),total,JSON.stringify(calculation)]);
          if (a) results.push(await this.settle(c,m,a,actor));
        }
        await c.query("UPDATE management_contracts SET next_period=$2 WHERE id=$1", [m.id,p]);
      }
      if (results.length || actor !== "scheduler") await this.audit(c, actor, "processing_run", { assessed: results.length });
      return { results };
    });
  }
  async assessmentAction(id: number, action: "retry" | "waive" | "refund", reason: string) {
    return this.atomic(async c => {
      const { rows: [a] } = await c.query("SELECT * FROM fee_assessments WHERE id=$1 FOR UPDATE", [id]);
      if (!a) throw new FeeError("Assessment not found", 404);
      const e = a.contract_id ? await this.managementContract(c,a.contract_id) : await this.enrollment(c, a.enrollment_id);
      if (action === "retry") {
        await this.enabled(c);
        if (e.state !== "active") throw new FeeError("Enrollment must be active before retry");
        if (!["unpaid", "skipped"].includes(a.status)) throw new FeeError("Only unpaid or skipped fees can be retried", 409);
        if (!e.accepted_at || a.due_date < billingToday(e.accepted_at) || a.due_date > this.today()) throw new FeeError("Invalid assessment date", 409);
        await this.audit(c, "admin", "retry_requested", { reason }, a.enrollment_id ?? undefined, id, a.contract_id ?? undefined);
        return this.settle(c, e, a, "admin");
      }
      if (action === "waive") {
        if (!["unpaid", "skipped"].includes(a.status)) throw new FeeError("Only unpaid or skipped fees can be waived", 409);
        const { rows: [row] } = await c.query("UPDATE fee_assessments SET status='waived',reason=$2 WHERE id=$1 RETURNING *", [id, reason]);
        await this.audit(c, "admin", "assessment_waived", { reason }, a.enrollment_id ?? undefined, id, a.contract_id ?? undefined);
        return camel(row);
      }
      if (a.status !== "paid" || a.refund_transaction_id) throw new FeeError("Only a paid, unrefunded assessment can be refunded", 409);
      const result = await c.query("UPDATE accounts SET balance=balance+$2::numeric WHERE id=$1 AND balance::text NOT IN ('NaN','Infinity','-Infinity') RETURNING id", [a.account_id, a.total]);
      if (!result.rows.length) throw new FeeError("Refund account unavailable or its cash balance is not finite", 409);
      const { rows: [t] } = await c.query(`INSERT INTO transactions(to_account_id,amount,description,transaction_type,status,is_demo)
        VALUES($1,$2,$3,'fee_refund','completed',false) RETURNING id`,
        [a.account_id, a.total, `CAD ${a.kind === "management" ? "annual management" : "monthly service"} fee refund · Assessment ${id}`]);
      const { rows: [row] } = await c.query("UPDATE fee_assessments SET status='refunded',reason=$2,refund_transaction_id=$3 WHERE id=$1 RETURNING *", [id, reason, t.id]);
      await this.audit(c, "admin", "assessment_refunded", { reason, refundTransactionId: t.id, originalTransactionId: a.transaction_id, total: a.total }, a.enrollment_id ?? undefined, id, a.contract_id ?? undefined);
      return camel(row);
    });
  }
}
