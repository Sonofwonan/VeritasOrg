---
name: Performance evidence
description: Evidence required before presenting client investment returns.
---

Do not treat stored numeric prices, purchase dates, account funding, or balances as proof of investment performance. Preserve balances separately from performance reporting.

**Why:** The current financial data can include simulated trade prices and generated transaction history without trustworthy market provenance. The user requires actual supported performance and excludes inheritance deposits and fee overdrafts from investment returns.

**How to apply:** Require verified price provenance and usable cost basis before displaying unrealized gains; require dated opening valuations and reconciled cash flows for period returns. Holding cost-basis gains are not YTD returns. Do not infer verification from a non-null price or from a record not being marked as demo. Nominal currency-symbol exceptions do not authorize price conversion.

Omit unsupported performance metrics from client screens rather than displaying “Unavailable” placeholders or a long performance explanation.

**Why:** The user clarified: “anything that's not available shouldn't be placed on the ui I'm building a professional website... this is not a demo”.

**How to apply:** Hide unsupported returns, gains and yields without inventing values. This does not authorize hiding failed balance retrieval or unresolved access checks; keep operational failures explicit and financial actions safely blocked.
