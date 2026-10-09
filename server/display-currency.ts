import type { Express, RequestHandler } from "express";
import type { Pool } from "pg";
import { z } from "zod";
import { accounts } from "@shared/schema";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { FeeService } from "./fees/service";

const currency = z.enum(["CAD", "GBP"]);
const positiveId = z.coerce.number().int().positive();
export const displayCurrencyChange = z.object({
  displayCurrency: currency,
  expectedDisplayCurrency: currency,
  confirmed: z.literal(true),
  reason: z.string().trim().min(1).max(500),
}).strict();

export class DisplayCurrencyError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export async function initializeDisplayCurrencyAudit(pool: Pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS client_display_currency_audit (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      actor TEXT NOT NULL,
      previous_currency TEXT NOT NULL CHECK (previous_currency IN ('CAD','GBP')),
      display_currency TEXT NOT NULL CHECK (display_currency IN ('CAD','GBP')),
      reason TEXT NOT NULL,
      confirmed BOOLEAN NOT NULL CHECK (confirmed),
      presentation_only BOOLEAN NOT NULL DEFAULT TRUE CHECK (presentation_only),
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
    CREATE OR REPLACE FUNCTION reject_display_currency_audit_edit() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN RAISE EXCEPTION 'Currency preference audit entries are immutable'; END;
    $$;
    DROP TRIGGER IF EXISTS display_currency_audit_immutable ON client_display_currency_audit;
    CREATE TRIGGER display_currency_audit_immutable BEFORE UPDATE OR DELETE ON client_display_currency_audit
      FOR EACH ROW EXECUTE FUNCTION reject_display_currency_audit_edit();
  `);
}

// Row lock + compare-and-set prevents an old staff form overwriting a newer decision.
// Nothing in the ledger, fee schedules, or settlement records is written here.
export async function changeDisplayCurrency(pool: Pool, id: number, input: unknown) {
  positiveId.parse(id);
  const data = displayCurrencyChange.parse(input);
  const connection = await pool.connect();
  try {
    await connection.query("BEGIN");
    const { rows: [user] } = await connection.query(
      "SELECT id, display_currency FROM users WHERE id=$1 FOR UPDATE", [id],
    );
    if (!user) throw new DisplayCurrencyError(404, "Client not found");
    if (user.display_currency !== data.expectedDisplayCurrency) {
      throw new DisplayCurrencyError(409, "The display preference changed. Refresh the client and confirm again.");
    }
    if (user.display_currency === data.displayCurrency) {
      throw new DisplayCurrencyError(409, "This client already uses the selected display preference.");
    }
    await connection.query("UPDATE users SET display_currency=$1 WHERE id=$2", [data.displayCurrency, id]);
    await connection.query(`INSERT INTO client_display_currency_audit
      (user_id,actor,previous_currency,display_currency,reason,confirmed)
      VALUES($1,'admin',$2,$3,$4,TRUE)`,
      [id, user.display_currency, data.displayCurrency, data.reason]);
    await connection.query("COMMIT");
    return { id, displayCurrency: data.displayCurrency };
  } catch (error) {
    await connection.query("ROLLBACK");
    throw error;
  } finally { connection.release(); }
}

export async function registerDisplayCurrencyRoutes(app: Express, pool: Pool, requireAdmin: RequestHandler) {
  await initializeDisplayCurrencyAudit(pool);
  const db = drizzle(pool);
  // As with billing controls, never permit the legacy default admin password.
  const admin: RequestHandler = (req, res, next) => {
    if (!process.env.ADMIN_PASSWORD) {
      return void res.status(503).json({ message: "Administrator authentication is not configured" });
    }
    requireAdmin(req, res, next);
  };
  const endpoint = (work: (req: any) => Promise<unknown>): RequestHandler => async (req, res) => {
    try { res.json(await work(req)); }
    catch (error) {
      if (error instanceof z.ZodError) return void res.status(400).json({ message: "Invalid client or display preference confirmation" });
      if (error instanceof DisplayCurrencyError) return void res.status(error.status).json({ message: error.message });
      console.error("[display-currency] Operation failed");
      res.status(500).json({ message: "The display preference operation failed. No partial change was saved." });
    }
  };
  app.patch("/api/admin/users/:id/display-currency", admin, endpoint(req =>
    changeDisplayCurrency(pool, positiveId.parse(req.params.id), req.body)));
  app.get("/api/admin/users/:id/accounts", admin, endpoint(async req =>
    db.select().from(accounts).where(eq(accounts.userId, positiveId.parse(req.params.id)))));
  const fees = new FeeService(pool);
  app.get("/api/admin/fees/clients/:id/summary", admin, endpoint(req =>
    fees.clientSummary(positiveId.parse(req.params.id))));
  app.get("/api/admin/users/:id/display-currency/audit", admin, endpoint(async req => {
    const result = await pool.query(`SELECT id,actor,previous_currency AS "previousCurrency",
      display_currency AS "displayCurrency",reason,confirmed,presentation_only AS "presentationOnly",
      created_at AS "createdAt" FROM client_display_currency_audit WHERE user_id=$1 ORDER BY id DESC`,
      [positiveId.parse(req.params.id)]);
    return result.rows;
  }));
}
