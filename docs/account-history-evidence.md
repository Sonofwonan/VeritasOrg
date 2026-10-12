# Account history evidence

## Owner report

The inspected historical records do not supply a complete, authoritative opening-to-closing cash ledger for every account. Existing history is retained, but unsupported historical “balance after transaction” values are deliberately omitted.

Specific evidence gaps found:

- The previous account-creation route generated random backdated transactions without changing the account balance. A completed status therefore does not prove a cash posting. New accounts no longer receive these generated rows; existing rows have not been deleted.
- Accounts can have an initial balance without a matching opening cash transaction. Some administrative balance adjustments also lack transaction evidence.
- Legacy pending outgoing requests deducted cash before approval, and rejection refunded that deduction without a separate cash transaction. Status alone cannot reconstruct these movements. Existing requests retain their original reserved-cash behavior; new outgoing requests defer cash movement until approval.
- Existing monthly/annual fee and refund transactions identify charges, but have no captured per-account before/after cash balances. Even a genuine fee debit cannot supply a complete running balance when intervening adjustments and other historical rows are unproven.
- Fixture-only inheritance/history/correction scripts can insert history separately from cash changes, or create an account with its funded balance already present. They were not executed or rewritten as part of this work.

No historical values were reverse-calculated from today's balance. Matching a sum of completed rows to today's balance is not sufficient evidence because the rows may be fabricated, incomplete, backdated, or omit adjustments.

## Supported values from now on

Actual balance changes capture exact PostgreSQL decimal before/after amounts and deterministic posting sequence inside the posting transaction. Transfers, verified deposits, purchases/sales in the storage layer, monthly/annual fee debits, and fee refunds explicitly associate that evidence with the genuine transaction. Both sides of an internal transfer have their own recorded cash balance.

Pending, failed, and rejected new requests do not post cash and receive no resulting-balance value. Pending incoming requests remain uncredited until trusted approval. Existing reserved-cash pending requests are not debited a second time.

Dashboard, account history, full history and statements use the same owner-filtered evidence. An account-specific response includes only that account's balances; a portfolio response includes only the signed-in client's accounts. Unsupported history remains visible without an unavailable-balance placeholder.

## Boundaries

Schema setup provisions application account numbers and evidence structures only. It does not change existing balances, holdings, fee prices, accepted contracts, billing schedules, access policies, or financial history; it does not process billing or run fixture scripts.

Application account numbers identify records within Veritas. They are not bank-issued IBANs, national routing numbers, payment-card numbers, or external payment instructions.

Historical balances can be added later only after documented opening/closing evidence and all relevant postings reconcile. An owner-authorized evidence-import process is needed; missing values must never be manufactured.
