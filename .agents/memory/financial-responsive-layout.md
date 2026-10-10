---
name: Financial responsive layouts
description: Why tablet/sidebar widths need separate money-layout verification
---

Verify monetary layouts at tablet/sidebar transition widths, not only phone and full desktop widths.

**Why:** The sidebar reduces usable content width at medium screen sizes. A balance and its controls can overlap, and adjacent summary amounts can collide, even when both the phone and full desktop layouts pass.

**How to apply:** In responsive financial UI changes, include intermediate widths with navigation visible. Check full-number line count, clipping, adjacent controls and sideways scrolling using the isolated normal-login browser harness.

Bound financial admin dialogs to the visible viewport and allow long identity text to wrap anywhere; percentage widths alone may not prevent mobile overflow.

**Why:** The currency dialog sometimes exceeded a 360-pixel viewport even after animations had settled. Waiting longer did not fix the containment failure.

**How to apply:** Use viewport-bounded sizing, preserve desktop width caps, and keep strict containment assertions rather than allowing a few pixels of overflow.
