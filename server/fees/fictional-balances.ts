import { createHash } from "node:crypto";
import type { HistoryImportInput } from "../../shared/history-import";
import { evidenceText, evidenceUnits } from "../../shared/history-import";

export type FictionalAccount = {
  id: number; user_id: number; is_demo: boolean; balance: string; created_at: Date | string;
};
export type FictionalTransaction = {
  id: number; from_account_id: number | null; to_account_id: number | null;
  amount: string; status: string; is_demo: boolean; cash_debit_deferred: boolean;
  created_at: Date | string;
};

/**
 * Explicitly owner-authorized test scenario, NOT external bank evidence.
 * Starts with a declared zero opening; never derives an opening from today's
 * balance, adds balancing adjustments, or performs financial writes.
 */
export function fictionalBalanceInput(
  account: FictionalAccount, transactions: FictionalTransaction[], declaredClosing: string,
): HistoryImportInput {
  if (!account.is_demo || transactions.length === 0) throw new Error("Missing fictional account history");
  const ordered = [...transactions].sort((a,b) =>
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime() || a.id - b.id);
  let running = 0n;
  const movements = ordered.map((t, index) => {
    if (!t.is_demo || t.status !== "completed" || t.cash_debit_deferred ||
      (t.from_account_id !== account.id && t.to_account_id !== account.id) ||
      t.from_account_id === t.to_account_id || evidenceUnits(t.amount) <= 0n) {
      throw new Error("Ambiguous or non-fictional movement; no balance reconstruction allowed");
    }
    const delta = evidenceUnits(t.amount) * (t.to_account_id === account.id ? 1n : -1n);
    running += delta;
    return {
      sequence: index+1, occurredAt: new Date(t.created_at).toISOString(),
      delta: evidenceText(delta), transactionId: t.id,
      sourceReference: `owner-authorized-fictional-ledger/account-${account.id}/row-${index+1}/transaction-${t.id}`,
      kind: "transaction" as const,
    };
  });
  if (running !== evidenceUnits(declaredClosing) || running !== evidenceUnits(account.balance)) {
    throw new Error("Fictional movements do not reconcile; refusing balancing entries or changed funds");
  }
  const start = new Date(account.created_at).toISOString();
  const end = new Date(new Date(ordered.at(-1)!.created_at).getTime()+1).toISOString();
  const declaration = { openingBalance: "0", closingBalance: declaredClosing, start, end, movements,
    nature: "Owner-authorized fictional scenario; not bank-issued history or verified settlement" };
  return {
    userId: account.user_id, accountId: account.id, start, end,
    openingBalance: "0", closingBalance: declaredClosing, movements, nonPostingTransactions: [],
    source: {
      kind: "synthetic_fixture", reference: `owner-authorized-fictional-history/account-${account.id}`,
      sha256: createHash("sha256").update(JSON.stringify(declaration)).digest("hex"),
      reviewedBy: "Project owner authorization and exact scenario reconciliation",
      notes: "Owner confirmed records are fictional and authorized balances matching the existing scenario. " +
        "Declared zero opening, chronological timestamp then transaction-ID tie order. " +
        "Existing recorded fictional movements only; no independent bank evidence, financial changes or invented adjustments.",
      complete: true, attested: true, ownerAuthorized: true,
    },
  };
}
