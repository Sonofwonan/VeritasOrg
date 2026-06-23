---
name: Veritas Wealth — Design Identity
description: Approved visual system for the platform. Apply to all new pages/components.
---

## The System

**Direction:** "Old Money, Digital Precision" — private banking editorial, NOT SaaS fintech startup.

**Why:** User explicitly rejected generic AI/SaaS look and approved this system. Keep it consistent across all future screens.

**Fonts**
- Headlines/display: `Cormorant Garamond` serif (italic for emphasis words)
- Body/UI: `DM Sans`
- Numbers/data: `DM Mono` with `font-variant-numeric: tabular-nums`
- Tailwind aliases: `font-serif`, `font-sans`, `font-mono`

**Colors**
- Background: warm cream `#F6F1E8` (CSS var `--background: 42 28% 97%`)
- Primary: deep forest green `#0B2218` (CSS var `--primary: 148 48% 17%`)
- Accent/numbers: warm gold `#B8832A` (CSS var `--accent: 38 62% 44%`)
- Text: near-black with green tint
- Dark sections: use `bg-[#0B2218]` directly

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
