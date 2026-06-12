// scripts/health/run.mjs
// Upotreba: node scripts/health/run.mjs [code|prod|signals]   (bez arga = svi slojevi)
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { loadHealthEnv } from "./lib/env.mjs";
import { formatReport, summarize } from "./lib/report.mjs";
import { sendAlert } from "./lib/email.mjs";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const layer = process.argv[2]; // undefined = svi

const results = [];
try {
  const env = loadHealthEnv(rootDir);
  if (!layer || layer === "code") {
    const { runCodeChecks } = await import("./checks/code.mjs");
    results.push(...(await runCodeChecks(rootDir)));
  }
  if (!layer || layer === "prod") {
    const { runProdDriftChecks } = await import("./checks/prod-drift.mjs");
    results.push(...(await runProdDriftChecks(rootDir, env)));
  }
  if (!layer || layer === "signals") {
    const { runSignalChecks } = await import("./checks/signals.mjs");
    results.push(...(await runSignalChecks(env)));
  }

  console.log(formatReport(results));
  writeFileSync(`${rootDir}/scripts/health/last-run.json`, JSON.stringify({ at: new Date().toISOString(), results }, null, 2));

  const s = summarize(results);
  if (s.fail > 0 || s.warn > 0) {
    const { sent } = await sendAlert(env, results);
    console.log(`\nAlert poslan: ${sent}`);
  }
  process.exit(s.exitCode);
} catch (e) {
  // Pad samog sistema NE smije biti tih — pokušaj alert pa izađi sa 1.
  console.error(`Health runner pao: ${e.message}`);
  try {
    const env = loadHealthEnv(rootDir);
    await sendAlert(env, [{ id: "health-runner", layer: "code", status: "FAIL", detail: `runner pao: ${e.message}` }]);
  } catch { /* env nedostupan — exit code je signal */ }
  process.exit(1);
}
