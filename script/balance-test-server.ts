import { existsSync } from "node:fs";
import { resolve, sep } from "node:path";

// This launcher is used only by the disposable browser harness, never by the
// application's development or production entrypoints.
const database = process.env.BALANCE_E2E_DATABASE;
const marker = process.env.BALANCE_E2E_LIQUIDATION_FAILURE;
const evidence = process.env.BALANCE_E2E_EVIDENCE;
const url = database ? new URL(database) : null;
if (process.env.NODE_ENV !== "test" || !url || url.hostname !== "127.0.0.1" ||
    url.pathname !== "/veritas_balance_e2e" || url.username !== "balance_test" ||
    !url.port || url.searchParams.get("sslmode") !== "disable" ||
    process.env.DATABASE_URL !== database || process.env.SUPABASE_DATABASE_URL !== database ||
    !evidence || !resolve(evidence).startsWith(resolve("test-results/balances") + sep) ||
    marker !== resolve(evidence, "liquidation-query-failure")) {
  throw new Error("Refusing status-query failure injection outside the isolated browser harness");
}

const { pool } = await import("../server/db");
const originalQuery = pool.query;
pool.query = function (...args: any[]) {
  const sql = typeof args[0] === "string" ? args[0] : args[0]?.text;
  // Fail only status reads. INSERT (including RETURNING), UPDATE, DELETE,
  // authentication, fee contracts and debt-clearance queries still run normally.
  if (typeof sql === "string" && /^\s*select\b/i.test(sql) &&
      /\binstitutional_transfers\b/i.test(sql) && existsSync(marker)) {
    const error = new Error("Isolated liquidation status SELECT failure");
    const callback = args[args.length - 1];
    if (typeof callback === "function") {
      queueMicrotask(() => callback(error));
      return;
    }
    return Promise.reject(error);
  }
  return (originalQuery as Function).apply(this, args);
} as typeof pool.query;

await import("../server/index");
