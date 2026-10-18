---
name: Supabase hosting
description: Preserve the existing Supabase database when changing the application host.
---

The application's existing database is on Supabase. Choosing Render for the application host does not authorize moving data to Render Postgres or creating a replacement database.

**Why:** The user stated that the database is already on Supabase and chose Render for hosting the application.

**How to apply:** Configure Render to use the existing Supabase connection. Do not copy, seed, migrate, or replace production data without explicit authorization.
