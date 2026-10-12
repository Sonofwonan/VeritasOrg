import type { Request } from "express";

// CORS and sensitive-write checks must agree on every supported frontend.
// Do not trust arbitrary Vercel/Replit subdomains or all development origins.
export function trustedOrigins(req: Pick<Request, "get">, env: NodeJS.ProcessEnv = process.env) {
  const configured = [
    ...(env.CLIENT_URL || "").split(","),
    "https://veritaswealth.vercel.app",
    "https://veritas-wealth.vercel.app",
    ...(env.REPLIT_DOMAINS || "").split(",").filter(d => d.trim()).map(d => `https://${d.trim()}`),
  ];
  const host = req.get("host");
  if (host) {
    configured.push(`https://${host}`);
    if (env.NODE_ENV !== "production") configured.push(`http://${host}`);
  }
  const origins = new Set<string>();
  for (const value of configured) {
    try {
      const url = new URL(value.trim());
      if (["http:", "https:"].includes(url.protocol) && !url.username && !url.password) {
        origins.add(url.origin);
      }
    } catch { /* Ignore malformed configuration, never allow a wildcard. */ }
  }
  return origins;
}

export function isTrustedOrigin(origin: string | undefined, req: Pick<Request, "get">, env: NodeJS.ProcessEnv = process.env) {
  if (origin === undefined) return true; // Non-browser API clients.
  try {
    // Browser Origin headers contain only an origin, never paths or credentials.
    if (new URL(origin).origin !== origin) return false;
    return trustedOrigins(req, env).has(origin);
  } catch { return false; }
}
