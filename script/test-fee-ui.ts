import { build } from "esbuild";
import { mkdtemp, rm, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { spawn } from "node:child_process";

// The real UI depends on Vite's import.meta.env and automatic JSX runtime.
// Bundle a test-only entry with those transforms; no preview/auth routes are added.
const parent = join(process.cwd(), ".local");
await mkdir(parent, { recursive: true });
const directory = await mkdtemp(join(parent, "fee-ui-tests-"));
try {
  const outfile = join(directory, "ui.test.mjs");
  await build({
    entryPoints: ["server/fees/ui.test.ts"], outfile, bundle: true, platform: "node",
    format: "esm", packages: "external", jsx: "automatic", target: "es2020",
    define: { "import.meta.env.VITE_API_URL": JSON.stringify("/api") },
  });
  const code = await new Promise<number>(resolve => {
    const child = spawn(process.execPath, ["--test", outfile], { stdio: "inherit" });
    child.on("error", error => { console.error(error); resolve(1); });
    child.on("exit", code => resolve(code ?? 1));
  });
  process.exitCode = code;
} finally { await rm(directory, { recursive: true, force: true }); }
