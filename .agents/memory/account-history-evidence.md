---
name: Historical cash evidence
description: Why legacy account history cannot safely be reconstructed from current balances or completed statuses.
---

Treat historical balance-after values as unsupported unless independently documented opening/closing evidence and the full cash history reconcile. Preserve the transaction and omit unsupported balances rather than inferring them from today's balance.

**Why:** Earlier account creation generated backdated completed transaction rows without moving cash; opening balances and administrative adjustments can also lack matching postings. A completed status or matching arithmetic total is not proof of cash movement.

**How to apply:** Distinguish the nominal transaction history from verified cash posting evidence in future imports, statements, and history features. Do not run fictional fixture operations or change shared financial records to repair the gap. Report gaps to the owner.

Historical restoration must use independently reviewed, owner-authorized source evidence for every actual cash movement, including reservations, returns and otherwise unlinked adjustments. Keep it separate from live posting evidence, preserve original transaction rows, and document source-confirmed non-posting rows rather than forcing them into cash arithmetic. Reconcile exact decimals; display rounding must not become source evidence.

**Why:** Legacy pending requests may already have reserved cash, while completed generated rows may never have moved it. Replaying rows or rounding intermediate balances can produce plausible but false histories without changing the visible transaction total.

**How to apply:** Source references, digests and staff attestations support an audit but cannot independently prove a fabricated list; retain and actually review the original source. Reject gaps and conflicts rather than relaxing checks to fill every row.
