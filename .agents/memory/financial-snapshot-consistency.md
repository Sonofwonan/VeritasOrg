---
name: Financial snapshot consistency
description: Keep cash and liability displays from mixing independently refreshed states.
---

Dashboard cash and fee liabilities must come from one committed database snapshot and remain one client cache entry, including during background refresh.

**Why:** Independent requests can complete on opposite sides of a payment, posting or refund, making older overdrafts appear beside newer amounts still owed. Fee billing locks alone cannot protect a read from payments that do not take those locks.

**How to apply:** Use a consistent read rather than chained invalidations or copying snapshot halves into independently mutable caches. Preserve existing nominal currency and clearance policies. Test commits between reads and deliberately delayed responses using a disposable local database.
