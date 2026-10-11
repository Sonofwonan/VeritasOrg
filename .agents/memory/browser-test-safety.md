---
name: Browser regression isolation
description: Safety boundaries for signed-in financial browser tests in this shared-database project.
---

Signed-in financial tests must use dedicated disposable identities and the normal password/session flow, never an authentication bypass. Do not use or modify shared clients, the Mary fixture, actual credentials or live billing settings.

**Why:** Development and production can share the external Supabase database. The user explicitly required isolation for browser setup and billing operations, not just cleanup after using real records.

**How to apply:** Use a disposable local database environment for account/fee/transfer changes and guard cleanup against real data. Do not seed the shared preview merely to obtain signed-in screenshots.

On Replit, prefer the packaged Chromium executable for local Playwright runs; a downloaded Linux Chromium assumes runtime libraries that may not be present in Nix.

**Why:** The downloaded browser launched unsuccessfully despite a successful installation because its shared-library dependencies were unavailable. The packaged browser includes its runtime closure.

**How to apply:** Use the harness browser override or platform-packaged browser rather than repeatedly reinstalling the download.

Playwright array-valued option fixtures need its explicit tuple wrapper in test.use; use an object-valued option for expected HTTP rejections to avoid that ambiguity.

**Why:** A plain array supplied through test.use was interpreted as fixture configuration instead of the value, causing response-evidence collection to fail.

**How to apply:** Configure rejection evidence by exact endpoint and status, and still assert the response message and unchanged financial records in the test.

Wait for final layout geometry when testing responsive disclosure controls; an updated aria state does not mean an offcanvas or height transition has finished.

**Why:** Browser regressions intermittently measured the header partway through a sidebar transition, despite the correct final collapsed state.

**How to apply:** Poll the expected final bounds rather than asserting one immediate bounding-box sample or adding arbitrary sleeps.

Error-recovery browser tests must allow normal background polling to recover after a mocked failure is removed.

**Why:** A restored history endpoint recovered automatically before a test clicked Retry, making a working interface look broken.

**How to apply:** Assert the failure and Retry control while the failure remains mocked. After restoring the endpoint, allow either the user retry or automatic recovery; do not assume the error persists across screenshots.

Recheck active-button contrast when replacing a disabled financial control with clickable blocked-action feedback.

**Why:** The existing readability checks excluded disabled controls. Making debt-blocked investment buttons clickable exposed an unreadable active color that those earlier checks could not detect.

**How to apply:** Verify enabled feedback controls and popup text at relevant widths, alongside tests proving blocked clicks never submit financial requests. A server-blocked action still needs readable, keyboard-accessible client feedback.
