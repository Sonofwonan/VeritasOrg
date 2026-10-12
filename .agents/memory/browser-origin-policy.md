---
name: Cross-origin credential flows
description: Why security-flow verification must include every approved browser frontend, not just same-origin preview
---

Verify login and sensitive security operations from each approved cross-origin
frontend whenever browser-origin policy changes. Passing same-origin tests is
not sufficient evidence that deployed frontend sign-in works.

**Why:** Same-origin password and authenticator tests passed while a separately
allowed frontend could not log in because CORS and the sensitive-write origin
check disagreed.

**How to apply:** Check credentialed preflights, login, pending second-factor
challenges and authenticated security changes from each approved origin. Keep
untrusted origins blocked; never solve an origin mismatch by trusting arbitrary
hosting-provider subdomains or all development origins.
