-- Optional hardening migration: ensure public schema exists and provide safe guidance
-- This migration is safe to run and will be a no-op if the schema already exists.

CREATE SCHEMA IF NOT EXISTS public;

-- Ensure basic usage privileges on the schema (grants to the built-in PUBLIC role)
GRANT USAGE ON SCHEMA public TO PUBLIC;

-- NOTE: If you want to ensure application connections always resolve unqualified table names to the public schema
-- you can set the search_path for the database role used by your app. This requires superuser privileges and
-- may be environment-specific. Example (replace <role> with your DB role):
-- ALTER ROLE <role> SET search_path = public, "$user";

-- Alternatively, prefer fully-qualified identifiers like public.users in application code (recommended) and
-- avoid relying on the database-level search_path to prevent issues with connection poolers like PgBouncer/Supabase.
