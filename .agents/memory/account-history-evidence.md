---
name: Historical cash evidence
description: Why legacy account history cannot safely be reconstructed from current balances or completed statuses.
---

Treat historical balance-after values as unsupported unless independently documented opening/closing evidence and the full cash history reconcile. Preserve the transaction and omit unsupported balances rather than inferring them from today's balance.

**Why:** Earlier account creation generated backdated completed transaction rows without moving cash; opening balances and administrative adjustments can also lack matching postings. A completed status or matching arithmetic total is not proof of cash movement.

**How to apply:** Distinguish the nominal transaction history from verified cash posting evidence in future imports, statements, and history features. Do not run fictional fixture operations or change shared financial records to repair the gap. Report gaps to the owner.
