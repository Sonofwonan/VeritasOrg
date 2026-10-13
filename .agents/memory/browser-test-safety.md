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

A running browser suite may keep pre-edit test assertions. Its error message can describe an old assertion while the displayed source excerpt reflects newer edits.

**Why:** During a long regression run, both browser projects retained old assertions after the test files changed, and the reported source lines no longer matched the actual errors.

**How to apply:** Use the recorded error and page snapshot to identify what ran. After assertion-only changes, finish the running suite and rerun affected cases; do not restore obsolete financial wording or behavior to satisfy cached tests.

A backend merge during a live Vite browser suite can mix a hot-reloaded client with the suite's older server.

**Why:** A new snapshot endpoint reached the client mid-run while the isolated server still lacked that route. Its SPA fallback returned HTTP 200, but not snapshot JSON, so otherwise valid balances appeared unavailable.

**How to apply:** Restart the main app after backend changes and rerun affected isolated checks from a consistent version. Treat a suite spanning such a merge as invalid evidence; do not weaken financial assertions or add inconsistent fallback balances.

Advancing frozen browser time does not settle network responses or synchronize independent queries.

**Why:** A status-change regression showed refreshed activity while a separately polled pending summary still held an earlier response. With time paused, ordinary assertion retries could not trigger its next refresh.

**How to apply:** Wait for each required financial state independently. When testing natural polling with a paused clock, advance virtual time during the wait so in-flight requests can finish and subsequent intervals can run. Keep the exact status and balance assertions; do not reload or weaken them to mask stale data.

Do not overlap managed and manually launched browser suites unless their report and artifact directories are isolated.

**Why:** Concurrent runs caused missing trace/network artifacts during context teardown even though the financial assertions passed; one run cleaned another run's output.

**How to apply:** Check the current browser workflow before each standalone run; an earlier stop does not prove it is still stopped. A named shell task's completion does not account for managed workflows. Give every invocation distinct output/report locations, including validation runs; scheduling alone cannot protect evidence when another runner starts later. Distinguish artifact collisions from application failures without suppressing assertion or teardown checks.

Wait for final layout geometry when testing responsive disclosure controls; an updated aria state does not mean an offcanvas or height transition has finished.

**Why:** Browser regressions intermittently measured the header partway through a sidebar transition, despite the correct final collapsed state.

**How to apply:** Poll the expected final bounds rather than asserting one immediate bounding-box sample or adding arbitrary sleeps.

Error-recovery browser tests must allow normal background polling to recover after a mocked failure is removed.

**Why:** A restored history endpoint recovered automatically before a test clicked Retry, making a working interface look broken.

**How to apply:** Assert the failure and Retry control while the failure remains mocked. After restoring the endpoint, allow either the user retry or automatic recovery; do not assume the error persists across screenshots.

Recheck active-button contrast when replacing a disabled financial control with clickable blocked-action feedback.

**Why:** The existing readability checks excluded disabled controls. Making debt-blocked investment buttons clickable exposed an unreadable active color that those earlier checks could not detect.

**How to apply:** Verify enabled feedback controls and popup text at relevant widths, alongside tests proving blocked clicks never submit financial requests. A server-blocked action still needs readable, keyboard-accessible client feedback.

Responsive financial checks across both browser projects can exceed the foreground shell's five-minute limit, even when every completed test passes.

**Why:** A targeted desktop/mobile run reached the shell timeout after desktop passed and while mobile was starting, leaving the combined run incomplete.

**How to apply:** Use a background shell for long matrices, or run narrowly filtered projects within the foreground limit. Keep completed, unchanged project checks valid; a tool timeout is not evidence of an application defect.

A merge's dependency refresh can temporarily remove Playwright's worker entry while a long suite is still running.

**Why:** A suite passed its entire desktop project, then every mobile worker failed before executing any test because the merge setup was replacing dependencies. The worker entry existed again once setup finished.

**How to apply:** Distinguish worker-startup/module-not-found failures from failed application assertions. Confirm dependency refresh has finished and the worker entry is restored, then rerun validation from the current merged project. Do not weaken security or financial checks to accommodate this infrastructure interruption.

After closing a modal, wait for it to detach before checking whether a background Retry control is visible.

**Why:** During the closing transition, the background can still be hidden from accessibility queries. A conditional visibility check can skip Retry even though it becomes available immediately afterward.

**How to apply:** Assert that the dialog is gone before choosing between manual retry and automatic recovery. Keep the original failure in place until its notice has been verified.

Inject only verification-read failures when proving that financial writes fail closed; keep the target writes available.

**Why:** Renaming an entire table also breaks inserts, which can hide an unguarded transfer-request endpoint. A request must fail because verification was unavailable, not because its eventual insert independently failed.

**How to apply:** Keep fault injection confined to the isolated test launcher, never a production endpoint. Check the explicit unavailable response, unchanged records and successful submission after restoring reads.
