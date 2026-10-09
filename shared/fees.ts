import { z } from "zod";

export const BILLING_TIME_ZONE = "America/Toronto";
export const DEFAULT_FEE_TERMS = "Monthly CAD service pricing for the listed services. You authorize deductions only from available cash recorded in this application, not an external bank account. No investment sales, overdraft, interest, late penalties, or partial charges. Insufficient cash leaves an unpaid assessment. You may end enrollment at any time to stop future fees; already assessed fees remain visible and may be waived by an administrator. No proration of a completed monthly period. Taxes are not calculated or represented as included. Applicable service eligibility and disclosures must be confirmed before offering this plan.";
export const OVERDRAFT_FEE_TERMS = "Monthly CAD service pricing for this account only. You explicitly authorize full fee debits to this account's application cash ledger, including when cash is zero or negative; this can create or increase a fee overdraft. Later deposits and refunds reduce that actual negative balance. No interest, penalties, external-bank debit, investment sale, or partial charge. Ending enrollment stops future fees, not previously posted charges. Annual discretionary-management fees, if separately accepted, are additional. No monthly proration. Taxes are not calculated. Account-specific eligibility must be confirmed.";
export const MANAGEMENT_TERMS = "CAD discretionary-management fees are additional to monthly service fees. Each completed annual period is billed in arrears on its opening anniversary at the greater of the annual AUM percentage or annual minimum, rounded half-up to cents. AUM uses a documented end-of-period holdings valuation, excluding cash and fee debt. An empty holdings ledger can be snapshotted automatically on the anniversary itself; other valuations require administrator-confirmed evidence. No historical market values are inferred. Missing valuation blocks posting. Zero holdings do not close the contract or stop its annual minimum. You authorize fee overdraft debits to this account only. No interest, penalties, external-bank debit, or investment liquidation. Pausing skips unbilled anniversary dates during the pause on resumption, without proration. Explicit termination stops future assessments; historical charges remain. Taxes are not calculated.";
export const DEFAULT_FEE_COMPONENTS = [
  { name: "Base maintenance", amount: "100.00", serviceDescription: "Account ledger maintenance and agreed account facilities." },
  { name: "Private relationship service", amount: "200.00", serviceDescription: "The agreed dedicated relationship service." },
  { name: "Administration / custody", amount: "63.64", serviceDescription: "Administration of agreed account and custody facilities." },
];

const moneyInput = z.string().regex(/^(0|[1-9]\d{0,5})(\.\d{1,2})?$/, "Enter a positive CAD amount with at most two decimal places");
export const feeScheduleInput = z.object({
  name: z.string().trim().min(3).max(100),
  components: z.array(z.object({
    name: z.string().trim().min(2).max(100),
    amount: moneyInput,
    serviceDescription: z.string().trim().min(10).max(1000),
  }).strict()).length(3),
  terms: z.string().trim().min(50).max(6000),
  funding: z.enum(["cash_only", "fee_overdraft"]).default("cash_only"),
}).strict();
export const managementOfferInput = z.object({
  accountId: z.number().int().positive(),
  openingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  annualMinimum: moneyInput,
  annualRatePercent: z.string().regex(/^(0|[1-9]\d?)(\.\d{1,2})?$|^100(\.0{1,2})?$/),
  terms: z.string().trim().min(50).max(6000),
  eligibilityConfirmed: z.literal(true),
}).strict();
export const managementValuationInput = z.object({
  period: z.number().int().nonnegative(),
  aum: z.string().regex(/^(0|[1-9]\d{0,11})(\.\d{1,2})?$/),
  evidence: z.string().trim().min(10).max(2000),
  confirmed: z.literal(true),
}).strict();
export const feeOfferInput = z.object({
  accountId: z.number().int().positive(),
  scheduleId: z.number().int().positive(),
  firstChargeDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  servicesConfirmed: z.literal(true),
}).strict();
export const feeAcceptanceInput = z.object({
  scheduleId: z.number().int().positive(),
  accepted: z.literal(true),
}).strict();

export interface FeeComponent { name: string; amount: string; serviceDescription: string }
export interface FeeSchedule {
  id: number; name: string; version: number; currency: "CAD"; components: FeeComponent[];
  total: string; terms: string; createdAt: string; funding?: "cash_only" | "fee_overdraft";
}
export interface FeeEnrollment {
  id: number; accountId: number; userId: number; scheduleId: number;
  state: "offered" | "active" | "paused" | "ended";
  firstChargeDate: string; nextPeriod: number; acceptedAt: string | null; createdAt: string;
  nextChargeDate: string | null; schedule: FeeSchedule; accountName: string; userName?: string;
}
export interface FeeAssessment {
  id: number; enrollmentId: number | null; accountId: number; period: number; dueDate: string;
  contractId?: number | null; kind?: "monthly" | "management"; funding?: "cash_only" | "fee_overdraft";
  calculation?: Record<string, unknown>;
  components: FeeComponent[]; total: string;
  status: "paid" | "unpaid" | "skipped" | "refunded" | "waived";
  reason: string | null; transactionId: number | null; refundTransactionId: number | null; createdAt: string;
}
export interface FeeAudit {
  id: number; enrollmentId: number | null; assessmentId: number | null; actor: string;
  action: string; detail: Record<string, unknown>; createdAt: string;
}
export interface FeeSettings { enabled: boolean; timeZone: string }
export interface FeeOverview {
  settings: FeeSettings; schedules: FeeSchedule[]; enrollments: FeeEnrollment[];
  assessments: FeeAssessment[]; audit: FeeAudit[];
  accounts: { id: number; userId: number; accountType: string; displayName?: string | null; balance: string; userName: string }[];
  contracts?: ManagementContract[];
  valuations?: ManagementValuation[];
}
export interface ClientFees {
  settings: FeeSettings; enrollments: FeeEnrollment[]; assessments: FeeAssessment[];
  contracts?: ManagementContract[];
  valuations?: ManagementValuation[];
  balance?: string;
}
export interface ManagementContract {
  id: number; accountId: number; userId: number; accountName: string; userName?: string;
  state: "offered" | "active" | "paused" | "ended"; openingDate: string;
  annualMinimum: string; annualRatePercent: string; terms: string;
  nextPeriod: number; nextChargeDate: string | null; acceptedAt: string | null;
  createdAt: string; funding: "fee_overdraft"; pricingInteraction: "additive";
}
export interface ManagementValuation {
  id: number; contractId: number; period: number; valuationDate: string; aum: string; evidence: string; createdAt: string;
}
export interface ClientFeeSummary {
  totalUnpaid: string;
  totalOverdraft?: string; totalOwed?: string;
  accounts: { accountId: number; unpaidTotal: string; unpaidCount: number; overdraft?: string; amountOwed?: string }[];
}
export interface FeePreview {
  enabled: boolean; timeZone: string; today: string; previewToken: string;
   charges: { enrollmentId: number | null; contractId?: number; kind?: "monthly" | "management"; funding?: "cash_only" | "fee_overdraft"; accountId: number; userName: string; period: number; dueDate: string; total: string;
    outcome: "payable" | "unpaid" | "skipped"; reason: string | null }[];
}
export interface FeeRunResult { results: FeeAssessment[] }

export function moneyToCents(value: string): bigint {
  if (!/^-?\d+(\.\d{1,2})?$/.test(value)) throw new Error("Invalid monetary precision");
  const negative = value.startsWith("-");
  const [whole, fraction = ""] = value.replace(/^-/, "").split(".");
  const cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
  return negative ? -cents : cents;
}

// Ledger balances can retain fractional cents (for example investment sale proceeds).
// Floor only the spendable comparison value; never round or rewrite the stored balance.
// For a whole-cent fee, floor(balance * 100) >= feeCents is exactly equivalent to
// PostgreSQL's decimal comparison balance >= fee. Non-finite ledger values are ineligible.
export function availableCashCents(value: string): bigint | null {
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(value);
  if (!match) return null;
  const fraction = match[3] || "";
  const cents = BigInt(match[2]) * 100n + BigInt((fraction + "00").slice(0, 2));
  return match[1] ? -cents - (/[1-9]/.test(fraction.slice(2)) ? 1n : 0n) : cents;
}
export function centsToMoney(cents: bigint): string {
  const negative = cents < 0n;
  const n = negative ? -cents : cents;
  return `${negative ? "-" : ""}${n / 100n}.${String(n % 100n).padStart(2, "0")}`;
}
export function formatCAD(amount: string | number): string {
  const n = Number(amount);
  if (!Number.isFinite(n)) return "Unavailable";
  return `CAD ${new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)}`;
}

export function billingToday(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BILLING_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const get = (type: string) => parts.find(p => p.type === type)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}
export function validateBillingDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(`${date}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
}
export function periodDate(anchor: string, period: number): string {
  if (!validateBillingDate(anchor) || !Number.isInteger(period) || period < 0) throw new Error("Invalid billing period");
  const [year, month, day] = anchor.split("-").map(Number);
  const start = new Date(Date.UTC(year, month - 1 + period, 1));
  const lastDay = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0)).getUTCDate();
  start.setUTCDate(Math.min(day, lastDay));
  return start.toISOString().slice(0, 10);
}
export function firstPeriodOnOrAfter(anchor: string, date: string): number {
  const [y, m] = date.split("-").map(Number);
  const [ay, am] = anchor.split("-").map(Number);
  let period = Math.max(0, (y - ay) * 12 + m - am);
  if (periodDate(anchor, period) < date) period++;
  return period;
}

export function annualDate(opening: string, period: number): string {
  return periodDate(opening, (period + 1) * 12);
}
export function managementFee(aum: string, ratePercent: string, minimum: string): string {
  const basisPoints = moneyToCents(ratePercent);
  const product = moneyToCents(aum) * basisPoints;
  const aumFee = (product + 5000n) / 10000n;
  const floor = moneyToCents(minimum);
  return centsToMoney(aumFee > floor ? aumFee : floor);
}
