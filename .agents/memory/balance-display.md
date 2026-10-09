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

**How to apply:** Distinguish cash ledger balance from net balance after genuinely unposted unpaid fees. Posted overdraft debits already reduced cash; never subtract them again. Neither unposted fees nor authorized fee overdrafts accrue interest.

Each account must have its own fees, overdrafted from that respective account, rather than only a separate unpaid-fee display.

**Why:** The user explicitly said, “Each account must have fees and all this fees must be overdrafted from their respective accounts.”

**How to apply:** Implement actual negative fee-funded ledger balances under explicit account-level authorization. Preserve previously accepted terms; never subtract already-posted fee debt a second time from net worth.

For discretionary management, an annual minimum must continue after investments are liquidated if the management contract stays open, including on the fictional Mary Scott profile.

**Why:** The user requested that this continuing management fee increase Mary's debt beyond the previous Trust-only fees.

**How to apply:** Model contract termination separately from zero holdings. Confirm exact CAD pricing, annual AUM rate, and whether the minimum is additional to monthly fees before posting new charges; do not infer overdraft interest.

Keep newly deposited funds visibly distinguishable from existing overdraft debt while including both in the current combined balance.

**Why:** The user said current balances and the deposit must reflect in the total, and asked to identify the overdraft separately from the main deposit.

**How to apply:** Show current account balances and an account-specific debt breakdown alongside the net total. Distinguish an original deposit transaction from the account's changing current balance; never obscure debt simply because another account has enough funds to offset it in aggregate.

For the inheritance deposit, show its date and amount in transaction history; on the dashboard show current balances and the total rather than a separate original-deposit figure.

**Why:** The user clarified that transaction history must show the deposit date and the balance should be reflected in the dashboard or total balance.

**How to apply:** Preserve the dated deposit entry, include its effect once in current totals, and retain separate overdraft identification without adding an original-inheritance-amount dashboard card.
