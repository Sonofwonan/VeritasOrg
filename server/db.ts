import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Log connection string info (masking credentials) for debugging
const maskedUrl = connectionString.replace(/:\/\/.*@/, "://****:****@");
console.log(`[db] Connecting to database: ${maskedUrl}`);

export const pool = new Pool({ 
  connectionString,
  ssl: { rejectUnauthorized: false } // Required for Supabase/Render in some cases
});

export const db = drizzle(pool, { schema });
