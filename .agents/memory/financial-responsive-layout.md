---
name: Financial responsive layouts
description: Why tablet/sidebar widths need separate money-layout verification
---

Verify monetary layouts at tablet/sidebar transition widths, not only phone and full desktop widths.

**Why:** The sidebar reduces usable content width at medium screen sizes. A balance and its controls can overlap, and adjacent summary amounts can collide, even when both the phone and full desktop layouts pass.

**How to apply:** In responsive financial UI changes, include intermediate widths with navigation visible. Check full-number line count, clipping, adjacent controls and sideways scrolling using the isolated normal-login browser harness.

Mobile information must fit horizontally at normal 100% browser zoom. Vertical scrolling is expected; zooming out to reveal amounts or columns is not.

**Why:** The user showed a dashboard where 50% zoom exposed fields that were cut off at 100%. Hiding horizontal overflow concealed the problem rather than fixing the layout.

**How to apply:** Check rendered text bounds against clipping ancestors, not only document scroll width. Let financial tables and activity rows reflow on narrow screens, keep every field available, and preserve readable amounts instead of scaling the entire page down.

Individual account balances belong to the right of the account name and masked number in the same header, including on phones. The account-details control remains below the masked number.

**Why:** The user repeatedly requested this mobile arrangement; desktop-only alignment did not meet the request.

**How to apply:** Keep a readable two-column account header across supported phone widths, preserving full digits and negative-balance styling rather than placing the amount in a separate card or scaling it excessively.

Bound financial admin dialogs to the visible viewport and allow long identity text to wrap anywhere; percentage widths alone may not prevent mobile overflow.

**Why:** The currency dialog sometimes exceeded a 360-pixel viewport even after animations had settled. Waiting longer did not fix the containment failure.

**How to apply:** Use viewport-bounded sizing, preserve desktop width caps, and keep strict containment assertions rather than allowing a few pixels of overflow.

Text-bound checks must distinguish visually hidden accessibility labels from visible financial figures.

**Why:** Native `checkVisibility()` still reports clipped screen-reader-only labels as visible; measuring their full text creates false overflow failures even when the displayed amount fits.

**How to apply:** Exclude genuinely screen-reader-only text from visual bounds checks while retaining accessible-name checks. Never exempt the displayed transaction amount or balance-after figure from containment tests.
