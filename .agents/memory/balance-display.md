---
name: Balance display
description: User's requirements for full-digit balances and CAD denomination.
---

Show balances in full digits, not abbreviated million notation such as "$2.80M".

**Why:** The user said abbreviated totals do not make sense and must be shown in full digits.

**How to apply:** Preserve full amounts when formatting account and portfolio balances, including on mobile.

Keep everything in CAD for now.

**Why:** The user explicitly gave this instruction when discussing service pricing.

**How to apply:** Keep account and service pricing denomination consistent with CAD until the user requests a change. Do not infer an exchange rate or silently convert existing amounts.

The CAD service-fee schedule is nominal pricing, not an exchange-rate conversion of the copied GBP example.

**Why:** The approved fee plan adopted CAD pricing and explicitly excluded foreign-exchange conversion and claims that the example represents typical bank fees.

**How to apply:** Do not describe this service pricing as converted GBP pricing or verified market-standard bank charges.

Do not normalize existing ledger balances merely to satisfy cent-precision fees; valid fractional-cent proceeds must be preserved.

**Why:** The account ledger permits fractional cents, so a strict two-decimal preview can fail while PostgreSQL settlement still processes a fee. Rounding stored cash would change customers' funds.

**How to apply:** Keep fee amounts in exact cents, compare available cash conservatively without rewriting it, and verify preview and settlement agree at fractional-cent boundaries.

Show unpaid service-fee debt on the dashboard and account summaries, not only in fee history, including negative net balances when fees exceed assets.

**Why:** The user said they could not see the fees on the dashboard and that they must appear there or as a negative account amount.

**How to apply:** Distinguish cash ledger balance from net balance after unpaid fees. Deduct only unpaid liabilities once; paid fees already reduced cash. Do not describe unpaid fees as an interest-bearing overdraft loan.
