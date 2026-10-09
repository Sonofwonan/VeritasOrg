import pg from "pg";
import { initializeFeeTables } from "../server/fees/migration";

// Reuse the application's existing database, without logging connection details.
const connectionString = process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL;
if (!connectionString) throw new Error("A configured database is required for fee schema setup");
const pool = new pg.Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15_000,
});

try {
  await initializeFeeTables(pool);
  console.log("Fee schema setup completed. No client fee processing or fixture updates were run.");
} catch {
  // Do not expose database credentials or financial details in automatic setup logs.
  console.error("Fee schema setup failed. No client fee processing or fixture updates were run.");
  process.exitCode = 1;
} finally {
  await pool.end();
}
