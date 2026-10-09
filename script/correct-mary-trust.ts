import pg from "pg";
import { correctMaryTrust } from "../server/fees/correct-mary-trust";

const pool = new pg.Pool({
  connectionString: process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL,
  ssl: { rejectUnauthorized:false }, connectionTimeoutMillis:15000,
});
async function main() {
  const apply = process.argv.includes("--apply-fictional-correction");
  if (apply && !process.argv.includes("--confirm-main-environment")) throw new Error("Review the preview and confirm the main environment before posting");
  console.log(JSON.stringify(await correctMaryTrust(pool,apply),null,2));
}
main().catch(()=>{
  console.error("Trust correction failed; no partial correction committed and no credentials printed");
  process.exitCode=1;
}).finally(()=>pool.end());
