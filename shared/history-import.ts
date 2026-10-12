import { z } from "zod";

// Evidence amounts must never pass through Number or get rounded to cents.
export const evidenceDecimal = z.string().regex(/^-?\d{1,30}(?:\.\d{1,18})?$/, "Use an exact decimal amount, not currency symbols or exponents");
const positiveId = z.number().int().positive().max(2147483647);
const timestamp = z.string().datetime({ offset: true });
export const historyImportSchema = z.object({
  userId: positiveId,
  accountId: positiveId,
  start: timestamp,
  end: timestamp,
  openingBalance: evidenceDecimal,
  closingBalance: evidenceDecimal,
  source: z.object({
    kind: z.enum(["statement", "ledger_export", "synthetic_fixture"]),
    reference: z.string().trim().min(3).max(240),
    sha256: z.string().regex(/^[a-fA-F0-9]{64}$/),
    reviewedBy: z.string().trim().min(3).max(120),
    notes: z.string().trim().min(10).max(2000),
    complete: z.boolean(),
    attested: z.boolean(),
    ownerAuthorized: z.boolean(),
  }).strict(),
  movements: z.array(z.object({
    sequence: z.number().int().positive().max(1000000),
    occurredAt: timestamp,
    delta: evidenceDecimal,
    transactionId: positiveId.nullable(),
    relatedTransactionId: positiveId.optional(),
    sourceReference: z.string().trim().min(1).max(240),
    kind: z.enum(["transaction", "adjustment", "reservation", "release"]),
  }).strict()).max(1000),
  // Staff must document why a recorded row was NOT a cash posting.
  // This never deletes, changes or "corrects" that transaction.
  nonPostingTransactions: z.array(z.object({
    transactionId: positiveId,
    reason: z.string().trim().min(10).max(500),
    sourceReference: z.string().trim().min(1).max(240),
  }).strict()).max(1000).default([]),
}).strict();

export type HistoryImportInput = z.infer<typeof historyImportSchema>;
export type HistoryIssue = { code: string; message: string; transactionId?: number };
export type HistoryPreviewRow = {
  sequence: number; transactionId: number | null; occurredAt: string;
  delta: string; balanceAfter: string; sourceReference: string;
};
export type HistoryPreview = {
  previewId: string; canApply: boolean;
  account: { accountId: number; accountNumber: string; accountName: string };
  openingBalance: string; closingBalance: string; calculatedClosing: string;
  issues: HistoryIssue[]; rows: HistoryPreviewRow[]; requiredRecords: string[];
};

const SCALE = 10n ** 18n;
/** Exact fixed-scale evidence arithmetic; accepts up to 18 decimal places. */
export function evidenceUnits(text: string): bigint {
  evidenceDecimal.parse(text);
  const negative = text.startsWith("-");
  const [whole, fraction = ""] = (negative ? text.slice(1) : text).split(".");
  const units = BigInt(whole) * SCALE + BigInt(fraction.padEnd(18, "0"));
  return negative ? -units : units;
}
export function evidenceText(units: bigint): string {
  const negative = units < 0n;
  const abs = negative ? -units : units;
  const fraction = (abs % SCALE).toString().padStart(18, "0").replace(/0+$/, "");
  return `${negative ? "-" : ""}${abs / SCALE}${fraction ? `.${fraction}` : ""}`;
}
