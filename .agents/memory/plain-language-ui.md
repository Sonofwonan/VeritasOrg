---
name: Plain-language client interface
description: Project-wide wording expectations and advisor-directed payment feedback.
---

Use clear, ordinary wording throughout the client interface. Avoid unnecessary notices, internal accounting jargon and record numbering in transaction descriptions. Payment popups must ask the client to contact their advisor.

**Why:** The user asked for a professional, simple interface across the project and specifically requested advisor-directed payment notices.

**How to apply:** “View transaction history” must lead to actual read-only transaction history, not a transfer form. Keep history accessible under the existing debt policy. Preserve accurate dates, account names, balances, fee contracts and access restrictions. Simplify surrounding explanations without deleting material consent terms, genuine error states or confirmed account holds. Do not substitute unsupported financial reassurance for removed technical wording.

Do not add a separate Wire action to the dashboard.

**Why:** The user considers it redundant because Transfer is already present.

**How to apply:** Use Transfer as the dashboard entry for transfers. This does not authorize removing wire-transfer capabilities elsewhere.

Account detail pages should prioritize balances and compact transaction history. Keep account details behind a deliberate button, and do not include login details on the account page. Fee-enrollment and management panels should not dominate the main screen.

**Why:** The user asked for a standard bank-style account page, rejected login details there, requested account details in a popup or separate page, and said fee-management sections were not important on the main screen.

**How to apply:** Keep fee offers, material terms and contract controls accessible through a deliberate Account services action. Actual fee debits remain in ordinary history with simple descriptions; simplifying presentation must not cancel contracts, delete charges or change access restrictions. Never invent bank account numbers to fill missing details.

The user wants permanent application-wide account identifiers, not official bank-issued payment details.

**Why:** When asked whether identifiers should be internal or official, the user clarified, “Not official butt something that can be used to identify all accounts across the entire project in that sense”.

**How to apply:** Persist consistent application account numbers rather than deriving inconsistent placeholders from database IDs. Do not present generated identifiers as officially assigned IBANs/routing numbers or external payment instructions.

Remove the dashboard's bottom Last updated line and account-figures currency footer captions. Remove Cash prefixes/suffixes from account figures and use Balance instead of Cash balance on individual account cards.

**Why:** The user specifically marked these captions as unnecessary in dashboard and Accounts screenshots.

**How to apply:** Preserve recorded transaction dates, account-type names, monetary currency symbols, and cash terminology in accepted fee terms or financial rules. Show supported balances after transactions under the amounts on both dashboard and account histories; do not invent missing history.
