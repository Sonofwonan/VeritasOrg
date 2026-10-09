import pg from "pg";
import { initializeFeeTables } from "../server/fees/migration";
import { applyMaryHistory, previewMaryHistory } from "../server/fees/fictional-history";

// Do not import server/db: avoid printing any database connection details.
const pool = new pg.Pool({
  connectionString: process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL,
  ssl: { rejectUnauthorized:false },
});
async function main() {
  const apply = process.argv.includes("--apply-fictional-overdraft");
  if (apply && (!process.argv.includes("--confirm-main-environment") || !process.argv.includes("--include-historical-management"))) {
    throw new Error("Application requires --confirm-main-environment and --include-historical-management after reviewing the preview");
  }
  // Schema changes only: this never enrolls or charges any client.
  await initializeFeeTables(pool);
  const preview = await previewMaryHistory(pool);
  console.log(JSON.stringify({preview},null,2));
  if (apply) console.log(JSON.stringify(await applyMaryHistory(pool),null,2));
}
main().catch(error => { console.error(error.message); process.exitCode=1; }).finally(() => pool.end());
