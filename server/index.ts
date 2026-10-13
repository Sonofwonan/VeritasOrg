import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { isTrustedOrigin } from "./security/origins";

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

// Set trust proxy for cross-domain cookies
if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
  app.set("trust proxy", "loopback, linklocal, uniquelocal");
}

// Bounded evidence documents can exceed the standard API's 100 kB limit.
// Handle this route's parse errors without propagating them to the crash handler.
const historyJson = express.json({ limit: "1mb" });
app.use("/api/admin/history", (req, res, next) => {
  historyJson(req, res, error => {
    if (error) return res.status(error.status || 400).json({ message: "History evidence must be valid JSON and no larger than 1 MB." });
    next();
  });
});

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

// Configure CORS to allow the frontend (Vercel) to call the API and include cookies
const trustedCors = cors({ credentials: true, origin: true });
app.use((req, res, next) => {
  if (!isTrustedOrigin(req.get("origin"), req)) {
    return res.status(403).json({ message: "This address is not allowed to access the application." });
  }
  return trustedCors(req, res, next);
});

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  // Dedicated security responses can contain one-time enrollment material.
  if (path.startsWith("/api/security/") || path.startsWith("/api/admin/security/") || path === "/api/client/contact-details") {
    res.setHeader("Cache-Control", "no-store");
    return next();
  }
  const redactResponseBody = /^\/api\/admin\/applications\/\d+\/approve$/.test(path)
    || path.startsWith("/api/admin/fees") || path.startsWith("/api/admin/history") || path.startsWith("/api/fees") || /^\/api\/accounts\/\d+\/fees$/.test(path)
    || path === "/api/accounts/snapshot" || path === "/api/login" || path === "/api/user";
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    if (!redactResponseBody) capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
