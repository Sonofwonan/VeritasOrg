---
name: Financial responsive layouts
description: Why tablet/sidebar widths need separate money-layout verification
---

Verify monetary layouts at tablet/sidebar transition widths, not only phone and full desktop widths.

**Why:** The sidebar reduces usable content width at medium screen sizes. A balance and its controls can overlap, and adjacent summary amounts can collide, even when both the phone and full desktop layouts pass.

**How to apply:** In responsive financial UI changes, include intermediate widths with navigation visible. Check full-number line count, clipping, adjacent controls and sideways scrolling using the isolated normal-login browser harness.
