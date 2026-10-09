---
name: Post-merge safety
description: Safe automatic setup boundaries for the externally shared banking database.
---

Automatic merge setup may initialize the existing database schema, restore locked dependencies, and build the app, but must not seed clients, apply fictional historical adjustments, or run billing.

**Why:** Development and published instances can share the external database. A routine task merge must not silently create financial history or charge accounts.

**How to apply:** Keep account-data adjustments and billing behind their explicit authorization paths. Do not use broad schema-push commands that can drop existing data or replace the external database.

A previously running app does not prove that its locked dependencies can pass a fresh installation: the package firewall can reject a vulnerable version during download.

**Why:** Adding the missing merge hook exposed a security-policy download block on a previously installed transitive dependency.

**How to apply:** Update the lockfile to a permitted patched version while preserving compatibility, then rerun clean setup. Never bypass the package firewall or skip dependency restoration to hide the failure.
