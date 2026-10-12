import type { Express, RequestHandler } from "express";
import type { Pool } from "pg";
import { z } from "zod";
import { HistoricalBalanceError, HistoricalBalanceService } from "./historical-balances";
import { initializeHistoricalBalances } from "./historical-balances-schema";

export async function registerHistoricalBalanceRoutes(app: Express, pool: Pool, requireAdmin: RequestHandler) {
  await initializeHistoricalBalances(pool);
  const service = new HistoricalBalanceService(pool);
  const admin: RequestHandler = (req,res,next) => {
    if (!process.env.ADMIN_PASSWORD) return void res.status(503).json({ message: "Administrator authentication is not configured" });
    requireAdmin(req,res,next);
  };
  const jsonOnly: RequestHandler = (req,res,next) => {
    if (!req.is("application/json")) return void res.status(415).json({ message: "Submit reviewed evidence as JSON" });
    next();
  };
  const endpoint = (work: (req: any) => Promise<unknown>): RequestHandler => async (req,res) => {
    res.set("Cache-Control","no-store");
    try { res.json(await work(req)); }
    catch (error) {
      if (error instanceof z.ZodError) return void res.status(400).json({
        message: "The evidence input is incomplete or invalid.",
        issues: error.issues.map(i => ({ path: i.path.join("."), message: i.message })),
      });
      if (error instanceof HistoricalBalanceError) return void res.status(error.status).json({ message: error.message });
      console.error("[historical-balances] Evidence operation failed");
      res.status(500).json({ message: "The evidence operation failed. No partial import was saved." });
    }
  };
  app.post("/api/admin/history/preview",admin,jsonOnly,endpoint(req => service.preview(req.body)));
  app.post("/api/admin/history/apply",admin,jsonOnly,endpoint(req => {
    const data = z.object({ previewId: z.string().uuid(), confirm: z.literal(true) }).strict().parse(req.body);
    return service.apply(data.previewId);
  }));
  app.get("/api/admin/history/imports",admin,endpoint(req => {
    const id = z.coerce.number().int().positive().max(2147483647).parse(req.query.accountId);
    return service.imports(id);
  }));
}
