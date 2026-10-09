import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { mkdtemp, rm, open, writeFile, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createServer } from "node:net";
import { randomBytes } from "node:crypto";
import pg from "pg";

// Own the entire cluster, not merely a schema in the client's database. No env
// file or inherited DB/admin/notification credential enters a child process.
const safeEnv: NodeJS.ProcessEnv = {};
for (const key of ["PATH", "HOME", "LANG", "LC_ALL", "LD_LIBRARY_PATH", "PLAYWRIGHT_BROWSERS_PATH"]) {
  if (process.env[key]) safeEnv[key] = process.env[key];
}
const workspace = resolve(".");
// npm installs browsers into the workspace cache on Replit; tsx children don't
// inherit npm's cache-directory override.
if (!safeEnv.PLAYWRIGHT_BROWSERS_PATH) {
  try {
    await access(resolve(".cache/ms-playwright"));
    safeEnv.PLAYWRIGHT_BROWSERS_PATH = resolve(".cache/ms-playwright");
  } catch { /* Use Playwright's normal home cache on other machines. */ }
}
// Nix's packaged browser includes its runtime libraries; the downloaded Linux
// browser assumes a conventional distro. Explicit override also supports CI.
if (process.env.BALANCE_E2E_CHROMIUM) {
  safeEnv.BALANCE_E2E_CHROMIUM = process.env.BALANCE_E2E_CHROMIUM;
} else {
  try {
    await access("/repl/tools/bin/chromium");
    safeEnv.BALANCE_E2E_CHROMIUM = "/repl/tools/bin/chromium";
  } catch { /* Use Playwright's installed Chromium outside Replit. */ }
}
const scratch = await mkdtemp(join(tmpdir(), "veritas-balance-e2e-"));
const dataDir = join(scratch, "pgdata");
const evidence = resolve("test-results/balances");
await import("node:fs/promises").then(fs => fs.mkdir(evidence, { recursive: true }));
const log = await open(join(evidence, "server.log"), "w");
let app: ChildProcess | undefined;
let started = false;
let pool: pg.Pool | undefined;
const pgBin = process.env.BALANCE_E2E_PG_BIN || "";
const executable = (name: string) => pgBin ? join(pgBin, name) : name;

async function freePort() {
  const server = createServer();
  await new Promise<void>(done => server.listen(0, "127.0.0.1", done));
  const port = (server.address() as { port: number }).port;
  await new Promise<void>(done => server.close(() => done()));
  return port;
}
function command(cmd: string, args: string[], env = safeEnv) {
  const result = spawnSync(cmd, args, { cwd: workspace, env, encoding: "utf8" });
  if (result.error || result.status !== 0) {
    throw new Error(`${cmd} failed: ${result.error?.message || result.stderr || result.stdout}`);
  }
  return result.stdout;
}
async function stopApp() {
  if (!app || app.exitCode !== null) return;
  const exited = new Promise<void>(done => app!.once("exit", () => done()));
  app.kill("SIGTERM");
  const timer = setTimeout(() => app?.kill("SIGKILL"), 5000);
  await exited;
  clearTimeout(timer);
}
let stopping = false;
async function cleanup() {
  if (stopping) return;
  stopping = true;
  await stopApp();
  await pool?.end();
  // Never issue DROP/DELETE on an inherited URL. Only stop/delete our mkdtemp cluster.
  if (started) command(executable("pg_ctl"), ["-D", dataDir, "-m", "immediate", "-w", "stop"]);
  await log.close();
  if (!scratch.startsWith(join(tmpdir(), "veritas-balance-e2e-")) || dataDir !== join(scratch, "pgdata")) {
    throw new Error("Refusing cleanup outside owned temporary cluster");
  }
  await rm(scratch, { recursive: true, force: true });
}
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => { void cleanup().finally(() => process.exit(130)); });
}

try {
  const dbPort = await freePort();
  const appPort = await freePort();
  command(executable("initdb"), ["-D", dataDir, "-U", "balance_test", "-A", "trust", "--no-locale", "--encoding=UTF8"]);
  command(executable("pg_ctl"), ["-D", dataDir, "-l", join(scratch, "postgres.log"), "-o",
    `-h 127.0.0.1 -p ${dbPort} -k ${scratch}`, "-w", "start"]);
  started = true;
  command(executable("createdb"), ["-h", "127.0.0.1", "-p", String(dbPort), "-U", "balance_test", "veritas_balance_e2e"]);
  const database = `postgresql://balance_test@127.0.0.1:${dbPort}/veritas_balance_e2e?sslmode=disable`;
  pool = new pg.Pool({ connectionString: database });
  const schema = command(resolve("node_modules/.bin/drizzle-kit"),
    ["export", "--dialect", "postgresql", "--schema", "shared/schema.ts"]);
  await pool.query(schema);
  const env = {
    ...safeEnv,
    NODE_ENV: "test",
    PORT: String(appPort),
    DATABASE_URL: database,
    SUPABASE_DATABASE_URL: database,
    SESSION_SECRET: randomBytes(32).toString("hex"),
    ADMIN_PASSWORD: randomBytes(32).toString("hex"),
    // Vite .env.local must not redirect browser traffic to a real backend.
    VITE_API_URL: "/api",
    BALANCE_E2E_URL: `http://127.0.0.1:${appPort}`,
    BALANCE_E2E_DATABASE: database,
    BALANCE_E2E_ADMIN: "",
  };
  env.BALANCE_E2E_ADMIN = env.ADMIN_PASSWORD;
  app = spawn(resolve("node_modules/.bin/tsx"), ["server/index.ts"], { cwd: workspace, env, stdio: ["ignore", log.fd, log.fd] });
  let ready = false;
  for (let i = 0; i < 120; i++) {
    if (app.exitCode !== null) throw new Error("Isolated app exited; inspect test-results/balances/server.log");
    try {
      const response = await fetch(`${env.BALANCE_E2E_URL}/api/user`);
      if (response.status === 401) { ready = true; break; }
    } catch { /* app not listening yet */ }
    await new Promise(done => setTimeout(done, 250));
  }
  if (!ready) throw new Error("Isolated server did not become ready");
  await writeFile(join(evidence, "isolation.json"), JSON.stringify({
    database: "Temporary local PostgreSQL cluster", auth: "Production Passport login/session routes",
    inheritedCredentials: false, cleanup: "Only mkdtemp-owned cluster is removed",
  }, null, 2));
  const result = await new Promise<number>(done => {
    const tests = spawn(resolve("node_modules/.bin/playwright"),
      ["test", "--config", "tests/balances/playwright.config.ts", ...process.argv.slice(2)], { cwd: workspace, env, stdio: "inherit" });
    tests.on("exit", code => done(code ?? 1));
    tests.on("error", error => { console.error(error.message); done(1); });
  });
  process.exitCode = result;
} finally {
  await cleanup();
}
