import { test } from "node:test";
import assert from "node:assert/strict";
import { historyImportSchema, evidenceUnits, evidenceText, type HistoryImportInput } from "../shared/history-import";
import { reconcileHistoricalBalances, type HistorySnapshot } from "./historical-balances-reconcile";

const source = { kind: "statement" as const, reference: "Isolated synthetic statement",
  sha256: "a".repeat(64), reviewedBy: "Synthetic reviewer", notes: "Only isolated test source records",
  complete: true, attested: true, ownerAuthorized: true };
function input(): HistoryImportInput {
  return { userId: 1, accountId: 10, start: "2024-01-01T00:00:00Z", end: "2024-02-01T00:00:00Z",
    openingBalance: "15.125", closingBalance: "-0.1225", source: { ...source },
    movements: [
      { sequence: 1, occurredAt: "2024-01-02T00:00:00Z", delta: "5.0025", transactionId: 20, sourceReference: "line 1", kind: "transaction" },
      { sequence: 2, occurredAt: "2024-01-02T00:00:00Z", delta: "-20.25", transactionId: 21, sourceReference: "line 2", kind: "transaction" },
    ], nonPostingTransactions: [] };
}
function snapshot(): HistorySnapshot {
  return {
    account: { id: 10, user_id: 1, account_number: "VW-SYNTHETIC", account_type: "Trust Account",
      display_name: null, balance: "900", created_at: "2024-01-01T00:00:00Z" },
    transactions: [
      { id: 20, from_account_id: null, to_account_id: 10, amount: "5.0025", status: "completed", cash_debit_deferred: false, created_at: "2024-01-02T00:00:00Z" },
      { id: 21, from_account_id: 10, to_account_id: null, amount: "20.25", status: "completed", cash_debit_deferred: false, created_at: "2024-01-02T00:00:00Z" },
    ], live: [], previous: [], historical: [],
  };
}
const check = (i = input(), s = snapshot()) => reconcileHistoricalBalances(historyImportSchema.parse(i),s,"fingerprint");
test("exact decimals, equal timestamps and documented source order do not infer from current cash", () => {
  const i = input();
  i.movements.reverse();
  const result = check(i);
  assert.equal(result.canApply,true);
  assert.deepEqual(result.rows.map(r => r.balanceAfter),["20.1275","-0.1225"]);
  assert.equal(snapshot().account.balance,"900");
  assert.equal(evidenceText(evidenceUnits("-000.100000000000000001")),"-0.100000000000000001");
  assert.equal(evidenceText(evidenceUnits("999999999999999999999999999999.99")),"999999999999999999999999999999.99");
  assert.throws(() => evidenceUnits("1e3"));
  assert.throws(() => evidenceUnits("0.1234567890123456789"));
});
for (const flag of ["complete","attested","ownerAuthorized"] as const) {
  test(`missing source ${flag} blocks apply`, () => {
    const i = input(); i.source[flag] = false;
    assert.equal(check(i).canApply,false);
  });
}
test("a made-up completed row is not proof; a documented non-posting explanation retains it without balance", () => {
  const s = snapshot();
  s.transactions.push({ ...s.transactions[1], id: 22, amount: "123" });
  const gaps = check(input(),s);
  assert.equal(gaps.canApply,false);
  assert.equal(gaps.issues.find(i => i.code === "UNMATCHED_TRANSACTION")?.transactionId,22);
  const i = input();
  i.nonPostingTransactions.push({ transactionId: 22, reason: "Source statement confirms this generated row never moved cash", sourceReference: "reconciliation line 22" });
  assert.equal(check(i,s).canApply,true);
  assert.equal(check(i,s).rows.some(row => row.transactionId === 22),false);
});
test("wrong amounts, timestamps, ownership, duplicate sequence/references and missing cash fail", () => {
  const cases = [
    (i: HistoryImportInput) => { i.movements[0].delta = "100"; },
    (i: HistoryImportInput) => { i.movements[0].occurredAt = "2024-01-03T00:00:00Z"; },
    (i: HistoryImportInput) => { i.movements[0].transactionId = 999; },
    (i: HistoryImportInput) => { i.movements[1].sequence = 1; },
    (i: HistoryImportInput) => { i.movements[1].sourceReference = "line 1"; },
    (i: HistoryImportInput) => { i.closingBalance = "0"; },
    (i: HistoryImportInput) => { i.movements[0].occurredAt = "2023-12-31T00:00:00Z"; },
  ];
  for (const change of cases) {
    const i = input(); change(i);
    assert.equal(check(i).canApply,false);
  }
  const s = snapshot(); s.transactions[0].to_account_id = 99;
  assert.equal(check(input(),s).canApply,false);
});
test("pending reservations and returned legacy cash require their own independent evidence", () => {
  const s = snapshot();
  s.transactions.push({ ...s.transactions[1], id: 22, amount: "1", status: "failed" });
  const i = input();
  assert.equal(check(i,s).canApply,false);
  i.movements.push(
    { sequence: 3, occurredAt: "2024-01-02T00:00:00Z", delta: "-1", transactionId: null, relatedTransactionId: 22, sourceReference: "reserved payment", kind: "reservation" },
    { sequence: 4, occurredAt: "2024-01-02T00:00:00Z", delta: "1", transactionId: null, relatedTransactionId: 22, sourceReference: "returned payment", kind: "release" },
  );
  assert.equal(check(i,s).canApply,true);
  s.transactions[2].cash_debit_deferred = true;
  assert.equal(check(i,s).canApply,false);
});
test("live evidence and previously accepted periods cannot be overwritten or silently omitted", () => {
  const s = snapshot();
  s.live.push({ id: "1", transaction_id: 20, balance_before: "15.125", balance_after: "20.1275", posted_at: "2024-01-02T00:00:00Z" });
  assert.equal(check(input(),s).canApply,true);
  s.live[0].balance_after = "20.5";
  assert.equal(check(input(),s).canApply,false);
  const i = input();
  i.nonPostingTransactions.push({ transactionId: 20, reason: "Cannot exclude captured actual cash", sourceReference: "bad exclusion" });
  assert.equal(check(i,s).canApply,false);
  const adjacent = snapshot();
  adjacent.previous.push({ id: "source", start_at: "2023-12-01T00:00:00Z", end_at: i.start, opening_balance: "0", closing_balance: "14", fingerprint: "previous" });
  assert.equal(check(input(),adjacent).canApply,false);
  adjacent.previous[0].closing_balance = "15.125";
  assert.equal(check(input(),adjacent).canApply,true);
  adjacent.previous[0].end_at = "2024-01-02T00:00:00Z";
  assert.equal(check(input(),adjacent).canApply,false);
});
test("unlinked cash changes require a documented source adjustment and exact before/after agreement", () => {
  const s = snapshot(), i = input();
  s.live.push({ id: "3", transaction_id: null, balance_before: "-0.1225", balance_after: "1.00005", posted_at: "2024-01-03T00:00:00Z" });
  assert.equal(check(i,s).canApply,false);
  i.movements.push({ sequence: 3, occurredAt: "2024-01-03T00:00:00Z", delta: "1.12255", transactionId: null, sourceReference: "documented adjustment", kind: "adjustment" });
  i.closingBalance = "1.00005";
  assert.equal(check(i,s).canApply,true);
});
