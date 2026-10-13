---
name: Veritas Wealth — Design Identity
description: Approved visual system for the platform. Apply to all new pages/components.
---

## The System

**Direction:** "Old Money, Digital Precision" — private banking editorial, NOT SaaS fintech startup.

**Why:** User explicitly rejected generic AI/SaaS look and approved this system. Keep it consistent across all future screens.

**Brand mark:** Use the user's green-and-gold torch, rising arrow and interlocking initials emblem for the website logo and app icon.

**Why:** The user supplied this emblem and explicitly chose it for both uses.

**How to apply:** Preserve the supplied artwork and its colors; do not replace it with the former logo or a generated alternative. Account and navigation previews kept for comparison are historical references.

**Fonts**
- Headlines/display: `Cormorant Garamond` serif (italic for emphasis words)
- Body/UI: `DM Sans`
- Numbers/data: `DM Mono` with `font-variant-numeric: tabular-nums`
- Tailwind aliases: `font-serif`, `font-sans`, `font-mono`

**Logo transparency:** Keep the supplied logo and browser/home-screen icon artwork background-free; do not add a cream tile behind the emblem.

**Why:** The user requested removal of the image background after approving this logo.

**How to apply:** Preserve the artwork's alpha transparency when producing resized branding assets. Operating systems may still supply their own home-screen icon background.

**Overview balance exception:** The dashboard total balance and Accounts overview summary figures use clean, bold, non-italic sans-serif text.

**Why:** The user explicitly selected “Clean, bold text” for the dashboard and later rejected the old balance font on the Accounts overview too.

**How to apply:** Preserve this choice in both overview panels; it does not authorize changing other headings or every monetary figure.

**Colors**
- Background: warm cream
- Primary: softly lightened forest green, not near-black green
- Accent/numbers: warm gold, with readable contrast on dark panels
- Text: near-black with green tint
- Dark sections: use the shared forest-panel palette rather than restoring the old deepest green

**Visibility rule:** Keep login actions prominent and essential copy readable, including muted labels, placeholders, errors, and text on dark panels.

**Why:** The user requested a modestly lighter green palette and more visible login actions and text, without changing the established design.

**How to apply:** Preserve the existing fonts, cream/green/gold identity and layouts. Check alpha-blended contrast against the actual surface, not just the opaque palette swatch.

**CSS state rule:** Opacity-color overrides must match standalone utility tokens, not substring matches that also capture hover or placeholder variants. Avoid blanket important foregrounds that prevent state-specific colors from winning.

**Why:** Broad overrides made inactive hover text light on cream and stopped foregrounds changing when their hovered backgrounds became green.

**How to apply:** Preserve hover/focus and light/dark context-specific foregrounds; verify those states in the isolated browser harness.

**Borders & radius**
- `--radius: 0.2rem` — near-zero rounding everywhere
- Horizontal rules as structure (not cards)
- Border separators (`divide-border`, `border-t border-border`) instead of card shadows

**Form inputs**
- Underline style only: `vw-input` utility class in `index.css`
- Labels: `label-caps` utility (small-caps, 0.12em letter-spacing)
- No input boxes / shadcn Input rounding

**Buttons**
- Primary: flat rectangle, `bg-primary text-primary-foreground`, no shadow
- Secondary: plain border rectangle `border border-border`
- Text links: small-caps with arrow icon

**Layout patterns**
- Editorial grid: asymmetric columns (e.g. `[1fr_1.2fr]`)
- Numbers in monospaced gold on dark green sections
- `divide-x divide-border` for horizontal data rows (not card grids)
- Hero: video full-bleed, editorial text bottom-left anchored
- Ticker: dark green bar with scrolling market data

**How to apply:**
Use on every new page/component. Avoid: blue primary, rounded cards, gradient text, shadcn card components as layout containers, generic grid-of-equal-cards patterns.
