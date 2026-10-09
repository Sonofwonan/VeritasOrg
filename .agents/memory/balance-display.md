---
name: Balance display
description: Full-digit balances, default CAD, Mary Scott's symbol-only £ exception, and separate overdrafts.
---

Every account must be identified by its account name, including debt breakdowns and selectors, rather than a number-only “Account #…” label.

**Why:** The user repeatedly corrected the fee-debt display, explicitly rejecting “Account #25” and requiring the specific account name.

**How to apply:** Use the account's display name or account type in client and administrative views. Keep IDs for routing and internal reconciliation, not as substitutes for names.

Show balances in full digits, not abbreviated million notation such as "$2.80M".

**Why:** The user said abbreviated totals do not make sense and must be shown in full digits.

**How to apply:** Preserve full amounts when formatting account and portfolio balances, including on mobile.

Keep other clients and the existing service-pricing plans in CAD. Mary Scott's account balances use £, retaining their existing numeric amounts.

**Why:** The user originally requested CAD throughout, then explicitly requested Mary Scott's balance/account in pounds and chose “Keep the same amounts; change the currency to £.”

**How to apply:** Remove CAD wording from all Mary's client-facing balance, fee, transaction and statement views; use only £, never GBP on her dashboard. Stored financial records and shared accepted pricing remain unchanged. Do not relabel a CAD/USD market quote as GBP/USD; omit it from her view rather than inventing an exchange rate. Do not change unrelated clients' currencies.

Avoid a standalone £ in Mary's balance/date caption or dashboard footer; the amounts already show their currency.

**Why:** The user circled the extra £ beside the date and asked to replace it with something user-friendly.

**How to apply:** Keep the caption as “Total balance · [date]” and use “Last updated [date]” in the footer, without duplicating the symbol.

Currency-symbol exceptions are explicit designations, not client-controlled profile preferences.

**Why:** Letting ordinary clients change the presentation symbol would make unconverted CAD ledger amounts appear to be pounds and violate the instruction to leave other clients in CAD.

**How to apply:** Reject client profile requests to change display currency. Any future staff currency workflow must separately authorize the designation and retain the stated no-conversion boundary.

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

Show current funded balances as the dashboard's main balance, with overdraft debt separately. For Mary, put the debt/payment-required notice at the very top, before the main balance. Other clients retain their existing below-balance placement.

**Why:** The user rejected netting the overdraft against available balances, then explicitly changed Mary's notice placement to the very top, before the main balance.

**How to apply:** Include all remaining positive cash balances across accounts and current holdings, not only the inheritance account or original deposit, separately from named account liabilities. Preserve the negative account ledger and its debt breakdown without subtracting it from the main funded-balance headline. Distinguish an original deposit transaction from the account's changing current balance.

For the inheritance deposit, show its date and amount in transaction history; on the dashboard show current balances and the total rather than a separate original-deposit figure.

**Why:** The user clarified that transaction history must show the deposit date and the balance should be reflected in the dashboard or total balance.

**How to apply:** Preserve the dated deposit entry, include its effect once in current totals, and retain separate overdraft identification without adding an original-inheritance-amount dashboard card.
