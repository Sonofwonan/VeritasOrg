# Audited inheritance date correction

The owner's approved fictional inheritance date is **October 12, 2026**,
at noon in Toronto (`2026-10-12T16:00:00.000Z`). The original October 8
transaction, accepted source, preview, import fingerprint and balance posting
remain immutable. An append-only `transaction_date_corrections` record links
the original transaction and accepted import to the effective date, with a
matching fixture audit entry. This is not external settlement evidence.

The client history APIs apply the effective date before sorting. Dashboard,
account and full history, date filters and CSV statements therefore use the
same date. The supported balance after the deposit remains **£1,622,886.00**.
Statement columns call this the transaction timestamp, not the original
recorded timestamp.

Reconciliation uses effective transaction/posting dates and effective import
boundaries for new evidence. An exact retry of an already accepted immutable
source uses only that source's original dates and fingerprint; it returns the
existing import, never another posting. A replacement overlapping source is
rejected. A subsequent import can start at the corrected closing boundary.
No immutable evidence trigger is bypassed.

Deliberate main-record procedure (never startup, migration, post-merge or billing):

```
npx tsx script/correct-mary-inheritance-date.ts
npx tsx script/correct-mary-inheritance-date.ts --apply-fictional-date-correction --confirm-main-environment
npx tsx script/correct-mary-inheritance-date.ts
```

The operation verifies the owner, fictional scenario audit, trust account,
deposit, explicitly authorized synthetic source and original fee provenance.
It refuses changed or ambiguous originals, intervening trust activity and
missing balance evidence. Protected-row fingerprints are compared inside the
transaction, including account/transaction balances, credentials and security
settings, identifiers, holdings, fee contracts/assessments, processing controls
and immutable history. Only the correction and its audit are inserted.
Repeating it validates the existing correction and makes no further writes.
The trust's opening date and November 8 first charge date are **not** moved.

Applied deliberately to the verified main fictional record on October 12,
2026. A second invocation returned `alreadyApplied: true`. Read-only verification
confirmed one correction and one matching audit, the effective October 12
client-history date, retained October 8 source evidence, unchanged £1,622,886.00
trust balance and -£12,398.48 brokerage balance. Shared-client credentials were
not used for browser verification; signed-in UI/CSV checks used disposable
accounts only.

`tests/balances/inheritance-date.spec.ts` verifies normal-login mobile/desktop
history and CSV dates, ordering across accounts, the muted resulting balance,
immutability, unauthorized-source rejection, original-source retry and later
effective-boundary import/retry. All test records are isolated and disposable.

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

### Published-screen investigation — October 12, 2026

The published application is healthy and already includes the balance-after renderer, reads `cashPostings`, and includes the reviewed historical-import workflow. Its public stylesheet matches the workspace build. Its JavaScript asset differs from the workspace's latest build; republishing alone does not create missing historical evidence.

Published request logs establish a **missing evidence/data** cause for these specific completed rows:

| Account | Transaction | Recorded date | Recorded amount | Returned balance evidence |
| --- | --- | --- | --- | --- |
| Brokerage Account | 575 · monthly service fee | October 1, 2026 | 363.64 debit | `cashPostings: []` |
| Brokerage Account | 574 · monthly service fee | September 1, 2026 | 363.64 debit | `cashPostings: []` |
| Inheritance Trust Account | 578 · inheritance deposit | October 8, 2026 | 1,622,886.00 credit | `cashPostings: []` |

The logs include the start of additional brokerage rows, but truncate the response; they do not establish a complete transaction-by-transaction inventory. The supplied screenshots additionally show April–July 2026 fees without a resulting-balance line. Those screenshots do not themselves supply the missing historical balances.

The owner-filtered API forwards evidence when present. Each of the dashboard, account-detail and full-history views renders that evidence directly beneath the amount. With an empty evidence array there is no muted balance element to style or reveal. This investigation has not imported evidence, altered shared records, or asserted that older rows are repaired.

**Blocking source inputs:** the original complete Brokerage Account opening-to-closing ledger from its January 2024 opening, including deposits, distributions, monthly/annual charges and any adjustments/reservations/refunds; and the Inheritance Trust Account opening ledger and deposit record for October 8, 2026, including any subsequent movements. Each needs independently documented opening and closing balances and chronological source references. No such statement, CSV/JSON ledger, spreadsheet or PDF has been supplied in the workspace attachments. Existing fixture scripts and today's account balances are not independent source evidence.

This was the initial diagnosis before the owner's subsequent clarification that these are fictional records. The owner then expressly requested internally documented fictional history that totals the existing account balance. That changes the applicable source policy for this scenario only; it does not authorize fabricated history for real customers.

### Owner-authorized fictional scenario

Fictional history uses the distinct `synthetic_fixture` source kind, never `statement` or `ledger_export`. It is not bank evidence or verified external settlement. The original zero opening, timestamp/transaction-ID posting order and existing fictional movements are explicitly declared. No opening balance is derived backwards from current funds, and no adjustment is invented to make the arithmetic match.

The service requires a source-specific internal authorization audit in addition to fictional account and transaction flags. Flags alone are insufficient because legacy defaults can mark ordinary accounts as demo records. Closing values must match unchanged current balances; missing transactions, conflicting live evidence and changes after preview still block apply.

The manual operation is narrowly restricted to the existing authorized fictional Mary scenario and its inheritance provenance. It inserts history metadata only. Never add it to startup, schema migrations, post-merge setup, scheduled processing or publish commands:

```sh
# Preview only; does not authorize or apply the scenario.
npx tsx script/apply-mary-history-balances.ts
# Owner-authorized main-environment metadata application only.
npx tsx script/apply-mary-history-balances.ts --apply-fictional-balances --confirm-main-environment
```

The existing 37 Brokerage movements reconcile from zero to −12,398.48; the Trust deposit reconciles from zero to 1,622,886.00. Deposits remain cash movements, not investment returns. Client screens retain normal account presentation and nominal £ symbols; internal import/audit records retain fictional provenance.

The owner-authorized main-environment metadata application succeeded on October 12, 2026. A subsequent read-only coverage check found all 37 Brokerage rows and the single Trust deposit supported. Before/after financial snapshots were identical, including amounts, statuses, holdings, fee enrollments/contracts/assessments, cash captures, currency, debt access controls and processing settings. No password or other credential was written.

Isolated normal-login browser checks verified the synthetic balance lines on dashboard, account detail and full history at widths 320, 390, 768, 1024 and 1440, including provenance authorization, idempotence and unchanged financial snapshots. Shared Mary's signed-in UI was not directly inspected; her imported data was checked read-only. The separate password/two-factor work is not part of this change.

## Supported values from now on

Actual balance changes capture exact PostgreSQL decimal before/after amounts and deterministic posting sequence inside the posting transaction. Transfers, verified deposits, purchases/sales in the storage layer, monthly/annual fee debits, and fee refunds explicitly associate that evidence with the genuine transaction. Both sides of an internal transfer have their own recorded cash balance.

Pending, failed, and rejected new requests do not post cash and receive no resulting-balance value. Pending incoming requests remain uncredited until trusted approval. Existing reserved-cash pending requests are not debited a second time.

Dashboard, account history, full history and statements use the same owner-filtered evidence. An account-specific response includes only that account's balances; a portfolio response includes only the signed-in client's accounts. Unsupported history remains visible without an unavailable-balance placeholder.

## Boundaries

Schema setup provisions application account numbers and evidence structures only. It does not change existing balances, holdings, fee prices, accepted contracts, billing schedules, access policies, or financial history; it does not process billing or run fixture scripts.

Application account numbers identify records within Veritas. They are not bank-issued IBANs, national routing numbers, payment-card numbers, or external payment instructions.

Historical balances can be added only after documented opening/closing evidence and all relevant postings reconcile. The owner-authorized staff import workflow below records that evidence; missing values must never be manufactured.

## Restore older balances from source records

The **Historical Balances** tab in the administrator portal accepts reviewed JSON evidence for one account and an inclusive opening / exclusive closing timestamp range. It provides a blank downloadable template and an input guide. No actual shared-client history has been imported automatically.

Required records:

- The account owner and application account number, documented opening and closing balances, and every actual cash movement in the range.
- The original statement or complete authoritative ledger export, its reference and SHA-256 digest, staff reviewer identity, review notes, confirmation that the source is complete, and the owner's authorization.
- A chronological source sequence and distinct source line reference for each movement. Equal timestamps use the documented source sequence, not database transaction IDs.
- Completed transaction matches must agree with the recorded account, timestamp, direction and exact amount. Source-only adjustments are retained as evidence without creating transactions.
- Legacy reservations and returned payments require their source movements and related outgoing request references. Recorded rows proven not to have moved cash require explicit non-posting explanations; they remain visible without a balance.

The source file selector computes its digest locally. It does not upload or retain the original source document. **Staff must retain that original document securely under the business's record-retention policy**; a digest or checked box alone cannot verify a fabricated list of application rows. Uploading JSON does not pre-approve review attestations.

Preview lists exact per-movement resulting balances, unmatched transactions, reservation ambiguities, conflicts, closing differences and missing records. The report can be downloaded for the owner. Decimal input supports up to 30 integer digits and 18 decimal places, with no floating-point reconciliation or rounding to cents. Invalid input identifies the fields that need correction.

Apply requires a reviewed, gap-free preview and explicit confirmation. The server expires previews after 30 minutes; the UI requests a fresh review after five minutes. Changes to the account/history since preview require a new preview. Imports are transactional, audited and idempotent. Overlapping replacements, disagreement with captured evidence or adjacent accepted periods, missing ownership/authorization and incomplete sources are refused. Original amounts, timestamps, statuses, balances, holdings, fees and access controls are never updated.

Historical evidence is stored separately from immutable live cash-change captures. Each history surface and CSV statement merges supported values with owner filtering; live captures take precedence. Both sides of an owned transfer retain distinct named account balances. Pending or unsupported rows do not receive fabricated balances or unavailable placeholders.

Client transaction rows use the same compact layout across account types: description/date/status on the left and the signed amount on the right, with a smaller muted resulting account balance directly underneath. Statements preserve source decimal digits even when the UI uses ordinary two-decimal currency display.

## Verification

Run the focused pure reconciliation checks with:

```sh
npx tsx --test server/historical-balances-reconcile.test.ts
```

Run the isolated browser/API checks with:

```sh
npm run test:balances:browser -- historical-balances.spec.ts account-postings.spec.ts
```

The browser runner owns a temporary local PostgreSQL cluster and uses normal login with disposable accounts. It never inherits shared database/admin credentials or writes to Mary or other shared clients. Tests cover all account types, CAD and nominal £ display, old and live postings, both transfer sides, owner privacy, conflict/retry/attestation guards, exact fractional amounts, unchanged financial and policy snapshots, staff preview/apply/audit, statements and normal-zoom phone/tablet/desktop containment.

Each runner invocation also owns a separate output directory under `test-results/balances/`, containing its server log, isolation record, browser artifacts and HTML report. The runner prints that directory at startup. Overlapping workflows or validation runs cannot clean another run's traces.
