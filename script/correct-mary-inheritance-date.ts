import pg from "pg";
import { correctInheritanceDate } from "../server/fees/inheritance-date";

// Manual date metadata only. Never add to startup, post-merge or publish.
const pool = new pg.Pool({
  connectionString: process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 15000,
});
async function main() {
  const apply = process.argv.includes("--apply-fictional-date-correction");
  if (apply && !process.argv.includes("--confirm-main-environment")) {
    throw new Error("Apply requires --confirm-main-environment after reviewing the exact date preview");
  }
  const { rows: owners } = await pool.query("SELECT id FROM users WHERE client_ref=$1 AND name=$2", ["VWMS2024","Mary Scott"]);
  if (owners.length !== 1) throw new Error("The explicitly authorized fictional owner was not found");
  console.log(JSON.stringify(await correctInheritanceDate(pool,owners[0].id,apply,true),null,2));
}
main().catch(error => {
  console.error(error instanceof Error && !("code" in error)
    ? error.message : "Date correction failed; no partial operation committed");
  process.exitCode = 1;
}).finally(() => pool.end());
