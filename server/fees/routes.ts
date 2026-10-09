import type { Express, RequestHandler } from "express";
import type { Pool } from "pg";
import { z, ZodError } from "zod";
import { FeeError, FeeService } from "./service";
import { initializeFeeTables } from "./migration";

const positiveId = z.coerce.number().int().positive();
const confirmedAction = z.object({ confirmed: z.literal(true), reason: z.string().trim().min(3).max(1000) }).strict();

export async function registerFeeRoutes(app: Express, pool: Pool, requireAdmin: RequestHandler) {
  await initializeFeeTables(pool);
  const service = new FeeService(pool);
  const endpoint = (work: (req: any) => Promise<unknown>): RequestHandler => async (req, res) => {
    try { res.json(await work(req)); }
    catch (error) {
      if (error instanceof ZodError) return void res.status(400).json({ message: error.issues.map(i => i.message).join("; ") });
      if (error instanceof FeeError) return void res.status(error.status).json({ message: error.message });
      console.error("[fees] Operation failed", error instanceof Error ? error.message : "Unknown error");
      res.status(500).json({ message: "The fee operation failed. No partial charge was applied." });
    }
  };
  // Preserve existing admin authentication but never accept its legacy fallback for billing.
  const feeAdmin: RequestHandler = (req, res, next) => {
    if (!process.env.ADMIN_PASSWORD) return void res.status(503).json({ message: "Billing administrator authentication is not configured" });
    requireAdmin(req, res, next);
  };
  const feeClient: RequestHandler = (req, res, next) => {
    if (!req.isAuthenticated()) return void res.status(401).json({ message: "Sign in to review your service fees" });
    const lastActivity = (req.session as any)?.lastActivity;
    if (lastActivity && Date.now() - lastActivity > 25 * 60 * 1000) {
      req.session.destroy(() => {});
      return void res.status(401).json({ message: "Session expired due to inactivity" });
    }
    if (req.method !== "GET" && !req.is("application/json")) return void res.status(415).json({ message: "JSON is required for fee authorization" });
    next();
  };
  app.get("/api/admin/fees", feeAdmin, endpoint(() => service.overview()));
  app.get("/api/admin/fees/preview", feeAdmin, endpoint(() => service.preview()));
  app.post("/api/admin/fees/schedules", feeAdmin, endpoint(req => service.createSchedule(req.body)));
  app.post("/api/admin/fees/offers", feeAdmin, endpoint(req => service.offer(req.body)));
  app.post("/api/admin/fees/settings", feeAdmin, endpoint(req => {
    const data = z.object({ enabled: z.boolean(), confirmed: z.literal(true) }).strict().parse(req.body);
    return service.settings(data.enabled);
  }));
  app.post("/api/admin/fees/run", feeAdmin, endpoint(req => {
    const { previewToken } = z.object({ confirmed: z.literal(true), previewToken: z.string().regex(/^[a-f0-9]{64}$/) }).strict().parse(req.body);
    return service.run("admin", previewToken);
  }));
  app.post("/api/admin/fees/enrollments/:id/state", feeAdmin, endpoint(req => {
    const { state } = z.object({ state: z.enum(["active", "paused", "ended"]) }).strict().parse(req.body);
    return service.changeState(positiveId.parse(req.params.id), state);
  }));
  for (const action of ["retry", "waive", "refund"] as const) {
    app.post(`/api/admin/fees/assessments/:id/${action}`, feeAdmin, endpoint(req => {
      const { reason } = confirmedAction.parse(req.body);
      return service.assessmentAction(positiveId.parse(req.params.id), action, reason);
    }));
  }
  app.get("/api/fees/summary", feeClient, endpoint(req => service.clientSummary(req.user.id)));
  app.get("/api/accounts/:id/fees", feeClient, endpoint(req => service.clientView(req.user.id, positiveId.parse(req.params.id))));
  app.post("/api/fees/enrollments/:id/accept", feeClient, endpoint(req => service.accept(req.user.id, positiveId.parse(req.params.id), req.body)));
  app.post("/api/fees/enrollments/:id/end", feeClient, endpoint(req => service.changeState(positiveId.parse(req.params.id), "ended", req.user.id)));

  // A dev instance can share the external database with production: never run its scheduler.
  // Production still requires explicit administrator activation of persisted settings.
  if (process.env.NODE_ENV === "production") {
    let running = false;
    const timer = setInterval(async () => {
      if (running) return;
      running = true;
      try {
        const { rows: [settings] } = await pool.query("SELECT enabled FROM fee_settings WHERE id=1");
        if (settings?.enabled) await service.run("scheduler");
      } catch (error) { console.error("[fees] Scheduled processing failed", error instanceof Error ? error.message : "Unknown error"); }
      finally { running = false; }
    }, 60_000);
    timer.unref();
  }
}
