import { evidenceUnits, evidenceText, type HistoryImportInput, type HistoryIssue, type HistoryPreviewRow } from "@shared/history-import";

export type HistorySnapshot = {
  account: { id: number; user_id: number; account_number: string; account_type: string; display_name: string | null; balance: string; created_at: string; is_demo?: boolean; fictional_history_authorized?: boolean };
  transactions: { id: number; from_account_id: number | null; to_account_id: number | null; amount: string; status: string; cash_debit_deferred: boolean; created_at: string | null; is_demo?: boolean }[];
  live: { id: string; transaction_id: number | null; balance_before: string; balance_after: string; posted_at: string }[];
  previous: { id: string; start_at: string; end_at: string; opening_balance: string; closing_balance: string; fingerprint: string }[];
  historical: { transaction_id: number | null; balance_after: string; occurred_at: string }[];
};

export function reconcileHistoricalBalances(input: HistoryImportInput, snapshot: HistorySnapshot, fingerprint: string) {
  const issues: HistoryIssue[] = [];
  const add = (code: string, message: string, transactionId?: number) => issues.push({ code, message, ...(transactionId ? { transactionId } : {}) });
  const start = Date.parse(input.start), end = Date.parse(input.end);
  if (end <= start) add("INVALID_RANGE", "The closing boundary must be later than the opening boundary.");
  if (!input.source.complete) add("INCOMPLETE_SOURCE", "Provide the complete source movement history, including adjustments and reserved or returned payments.");
  if (!input.source.attested) add("SOURCE_NOT_REVIEWED", "A staff reviewer must attest that the opening, closing and all movements were checked against the actual source document.");
  if (!input.source.ownerAuthorized) add("OWNER_AUTHORIZATION_MISSING", "Confirm the account owner's authorization for this evidence import.");
  if (input.source.kind === "synthetic_fixture") {
    if (snapshot.account.is_demo !== true || snapshot.account.fictional_history_authorized !== true ||
      snapshot.transactions.some(t => t.is_demo !== true)) {
      add("NOT_FICTIONAL", "Synthetic history requires explicit internal authorization for this exact scenario, plus fictional account and transaction markers.");
    }
    if (evidenceUnits(snapshot.account.balance) !== evidenceUnits(input.closingBalance)) {
      add("FIXTURE_BALANCE_CHANGED", "The fictional closing balance must match the unchanged account balance.");
    }
  }
  const duplicate = snapshot.previous.find(p => p.fingerprint === fingerprint);
  for (const p of snapshot.previous) {
    if (p.fingerprint === fingerprint) continue;
    if (Date.parse(p.start_at) < end && Date.parse(p.end_at) > start) {
      add("OVERLAPPING_IMPORT", "This period overlaps previously accepted evidence. A conflicting replacement cannot be applied.");
    }
    if (Date.parse(p.end_at) === start && evidenceUnits(p.closing_balance) !== evidenceUnits(input.openingBalance)) {
      add("OPENING_CONFLICT", "The opening balance disagrees with the previous verified period's closing balance.");
    }
    if (Date.parse(p.start_at) === end && evidenceUnits(p.opening_balance) !== evidenceUnits(input.closingBalance)) {
      add("CLOSING_CONFLICT", "The closing balance disagrees with the next verified period's opening balance.");
    }
  }
  const txns = new Map(snapshot.transactions.map(t => [t.id, t]));
  const live = new Map(snapshot.live.filter(p => p.transaction_id != null).map(p => [p.transaction_id!, p]));
  const historical = new Map(snapshot.historical.filter(p => p.transaction_id != null).map(p => [p.transaction_id!, p]));
  const excluded = new Map<number, typeof input.nonPostingTransactions[number]>();
  for (const exclusion of input.nonPostingTransactions) {
    if (excluded.has(exclusion.transactionId)) add("DUPLICATE_EXCLUSION", "A non-posting transaction was listed twice.", exclusion.transactionId);
    excluded.set(exclusion.transactionId, exclusion);
    const t = txns.get(exclusion.transactionId);
    if (!t || (t.from_account_id !== input.accountId && t.to_account_id !== input.accountId) ||
      !t.created_at || Date.parse(t.created_at) < start || Date.parse(t.created_at) >= end) {
      add("INVALID_EXCLUSION", "A non-posting explanation must refer to this account and this period.", exclusion.transactionId);
    }
    if (live.has(exclusion.transactionId) || historical.has(exclusion.transactionId)) {
      add("EXCLUSION_CONFLICT", "A transaction with actual cash posting evidence cannot be excluded.", exclusion.transactionId);
    }
  }
  const sequences = new Set<number>(), references = new Set<string>(), matched = new Set<number>();
  const reservations = new Set<number>(), releases = new Set<number>();
  const sorted = [...input.movements].sort((a, b) => a.sequence - b.sequence);
  const rows: HistoryPreviewRow[] = [];
  let balance = evidenceUnits(input.openingBalance), lastTime = start;
  for (const movement of sorted) {
    const time = Date.parse(movement.occurredAt);
    if (sequences.has(movement.sequence)) add("DUPLICATE_SEQUENCE", "Each source movement needs a unique sequence.");
    sequences.add(movement.sequence);
    if (references.has(movement.sourceReference)) add("DUPLICATE_SOURCE_REFERENCE", "Each source movement needs a distinct source line reference.");
    references.add(movement.sourceReference);
    if (time < start || time >= end) add("OUTSIDE_RANGE", "A source movement falls outside the selected opening-to-closing period.", movement.transactionId ?? undefined);
    if (time < lastTime) add("ORDERING_CONFLICT", "Source sequence is not chronological. Correct the documented posting order rather than sorting equal timestamps arbitrarily.");
    lastTime = time;
    const delta = evidenceUnits(movement.delta);
    if (delta === 0n) add("ZERO_MOVEMENT", "A cash movement cannot have a zero amount.");
    if (movement.kind === "transaction") {
      const id = movement.transactionId;
      const t = id == null ? undefined : txns.get(id);
      if (!t || (t.from_account_id !== input.accountId && t.to_account_id !== input.accountId)) {
        add("UNKNOWN_TRANSACTION", "The source posting does not match a transaction belonging to this account.", id ?? undefined);
      } else {
        if (matched.has(t.id)) add("DUPLICATE_TRANSACTION", "A transaction was matched to more than one source movement.", t.id);
        matched.add(t.id);
        if (excluded.has(t.id)) add("EXCLUSION_CONFLICT", "A transaction cannot be both a posting and a non-posting row.", t.id);
        if (t.status !== "completed") add("NOT_COMPLETED", "This recorded transaction is not a completed cash posting. Reserved or returned payments require separate source evidence.", t.id);
        if (!t.created_at || Date.parse(t.created_at) !== time) add("DATE_MISMATCH", "The source posting timestamp does not match the recorded transaction. Resolve the match with authoritative records before importing.", t.id);
        const expected = t.to_account_id === input.accountId && t.from_account_id !== input.accountId
          ? evidenceUnits(t.amount) : t.from_account_id === input.accountId && t.to_account_id !== input.accountId ? -evidenceUnits(t.amount) : null;
        if (expected === null || expected !== delta) add("AMOUNT_MISMATCH", "The source cash movement does not match the recorded transaction's direction and exact amount.", t.id);
        const authoritative = live.get(t.id);
        if (authoritative && (evidenceUnits(authoritative.balance_before) !== balance ||
          evidenceUnits(authoritative.balance_after) !== balance + delta)) {
          add("LIVE_EVIDENCE_CONFLICT", "The source resulting balance disagrees with immutable live cash evidence.", t.id);
        }
        const prior = historical.get(t.id);
        if (prior && evidenceUnits(prior.balance_after) !== balance + delta) {
          add("HISTORICAL_EVIDENCE_CONFLICT", "The source resulting balance disagrees with previously accepted historical evidence.", t.id);
        }
      }
      if (movement.relatedTransactionId != null) add("UNEXPECTED_RELATED_TRANSACTION", "Completed postings should use transactionId, not a reservation reference.");
    } else {
      if (movement.transactionId !== null) add("NON_POSTING_MATCH", "Adjustments, reservations and releases are source movements, not completed transaction matches.");
      if (movement.kind === "adjustment") {
        if (movement.relatedTransactionId != null) add("UNEXPECTED_RELATED_TRANSACTION", "Adjustments need their own source reference, not a reserved-payment match.");
      } else {
        const id = movement.relatedTransactionId;
        const t = id == null ? undefined : txns.get(id);
        if (!t || t.from_account_id !== input.accountId || t.cash_debit_deferred || t.to_account_id === input.accountId) {
          add("RESERVATION_AMBIGUITY", "Reserved or returned payments need the related legacy outgoing request and independent source evidence.", id);
        } else {
          const seen = movement.kind === "reservation" ? reservations : releases;
          if (seen.has(t.id)) add("DUPLICATE_RESERVATION", "A payment reservation or release was repeated.", t.id);
          seen.add(t.id);
          const expected = movement.kind === "reservation" ? -evidenceUnits(t.amount) : evidenceUnits(t.amount);
          if (expected !== delta || (movement.kind === "release" && t.status !== "failed")) {
            add("RESERVATION_MISMATCH", "The source reserved or returned payment disagrees with the legacy request's amount or status.", t.id);
          }
        }
      }
    }
    balance += delta;
    rows.push({ sequence: movement.sequence, transactionId: movement.transactionId, occurredAt: movement.occurredAt,
      delta: evidenceText(delta), balanceAfter: evidenceText(balance), sourceReference: movement.sourceReference });
  }
  for (const t of snapshot.transactions) {
    const belongs = t.from_account_id === input.accountId || t.to_account_id === input.accountId;
    const inRange = t.created_at && Date.parse(t.created_at) >= start && Date.parse(t.created_at) < end;
    if (!belongs || !inRange) continue;
    if (t.status === "completed" && !matched.has(t.id) && !excluded.has(t.id)) {
      add("UNMATCHED_TRANSACTION", "Provide a source match, or a reviewed source explanation proving this recorded row never changed cash.", t.id);
    }
    if (t.from_account_id === input.accountId && !t.cash_debit_deferred && t.status !== "completed" && !excluded.has(t.id)) {
      if (!reservations.has(t.id) || (t.status === "failed" && !releases.has(t.id))) {
        add("RESERVATION_AMBIGUITY", "This legacy request may have reserved or returned cash. Provide all source movements or a reviewed non-posting explanation.", t.id);
      }
    }
  }
  // Independently captured changes must not disappear inside an imported period,
  // including unlinked administrative changes.
  const cashRows = rows.filter(r => r.transactionId !== null);
  const adjustments = input.movements.filter(m => m.kind !== "transaction");
  for (const p of snapshot.live) {
    const time = Date.parse(p.posted_at);
    if (time < start || time >= end) continue;
    if (p.transaction_id != null) {
      if (!matched.has(p.transaction_id)) add("MISSING_LIVE_MOVEMENT", "An actual captured cash posting in this period is missing from the source reconciliation.", p.transaction_id);
    } else {
      const matching = adjustments.filter(m => Date.parse(m.occurredAt) === time &&
        evidenceUnits(m.delta) === evidenceUnits(p.balance_after) - evidenceUnits(p.balance_before));
      if (matching.length !== 1) add("MISSING_ADJUSTMENT", "An independently captured balance adjustment needs an unambiguous source match.");
      else {
        const row = rows.find(r => r.sequence === matching[0].sequence)!;
        if (evidenceUnits(row.balanceAfter) !== evidenceUnits(p.balance_after)) add("ADJUSTMENT_CONFLICT", "The source adjustment disagrees with captured before/after balances.");
      }
    }
  }
  if (balance !== evidenceUnits(input.closingBalance)) add("CLOSING_MISMATCH", `Calculated closing ${evidenceText(balance)} does not equal the source closing ${input.closingBalance}. Supply missing or corrected source evidence.`);
  return {
    canApply: issues.length === 0, issues, rows, calculatedClosing: evidenceText(balance),
    requiredRecords: [...new Set(issues.map(issue => issue.message))],
    duplicate, postingCount: cashRows.length,
  };
}
