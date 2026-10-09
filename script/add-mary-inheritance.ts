import pg from "pg";
import { inheritanceAccount } from "../server/fees/inheritance";

// Deliberate operation in the intended main environment. Never add to automatic setup.
const pool = new pg.Pool({
  connectionString: process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL,
  ssl: { rejectUnauthorized:false }, connectionTimeoutMillis:15000,
});
async function main() {
  const apply = process.argv.includes("--apply-fictional-inheritance");
  if (apply && !process.argv.includes("--confirm-main-environment")) {
    throw new Error("Posting requires --confirm-main-environment after reviewing the preview");
  }
  console.log(JSON.stringify(await inheritanceAccount(pool,apply),null,2));
}
main().catch(error => {
  // Never print connection credentials or database error payloads.
  console.error(error instanceof Error && !("code" in error) ? error.message : "Inheritance operation failed; no partial posting was committed");
  process.exitCode=1;
}).finally(() => pool.end());
