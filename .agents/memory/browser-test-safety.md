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
