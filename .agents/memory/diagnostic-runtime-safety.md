---
name: Diagnostic runtime safety
description: Keep one-off diagnostics from changing project runtimes unexpectedly.
---

Use the project's existing runtime for temporary calculations and diagnostic scripts.

**Why:** Launching a command in another language can automatically add its runtime to the project configuration, even for a one-off contrast calculation. This introduces unrelated deployment changes.

**How to apply:** Use Node for this JavaScript project's temporary calculations. If another runtime is genuinely required, manage it deliberately through the package-management workflow.
