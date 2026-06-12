// scripts/health/checks/code.mjs
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { RULES, checkFileAgainstRule } from "../lib/rules.mjs";

// process.execPath is the absolute path to the running node binary.
// launchd agents run with a minimal PATH (no /opt/homebrew/bin) so we
// must never rely on `node` or `env node` being resolvable via shell.
const NODE = process.execPath;

function runNode(id, nodeArgs, rootDir) {
  try {
    execFileSync(NODE, nodeArgs, { cwd: rootDir, stdio: "pipe", timeout: 300_000 });
    return { id, layer: "code", status: "PASS", detail: `${NODE} ${nodeArgs.join(" ")}` };
  } catch (e) {
    const out = `${e.stdout ?? ""}${e.stderr ?? ""}`.slice(-400);
    return { id, layer: "code", status: "FAIL", detail: `${nodeArgs[0]} pao`, actual: out };
  }
}

export async function runCodeChecks(rootDir) {
  const results = [];

  // tsc: invoke via node directly (node_modules/.bin/tsc shebang uses /usr/bin/env node)
  results.push(runNode("typecheck", ["node_modules/typescript/bin/tsc", "--noEmit"], rootDir));

  // vitest: same — bypass the shebang wrapper
  results.push(runNode("unit-tests", ["node_modules/vitest/dist/cli.js", "run", "--reporter=dot"], rootDir));

  const files = execFileSync("git", ["ls-files", "src"], { cwd: rootDir, encoding: "utf8" })
    .split("\n")
    .filter((f) => /\.(ts|tsx)$/.test(f));

  for (const rule of RULES) {
    const violations = files.flatMap((f) =>
      checkFileAgainstRule(rule, f, readFileSync(`${rootDir}/${f}`, "utf8")),
    );
    if (violations.length === 0) {
      results.push({ id: rule.id, layer: "code", status: "PASS", detail: rule.message });
    } else {
      results.push({
        id: rule.id,
        layer: "code",
        status: rule.severity,
        detail: rule.message,
        actual: violations.map((v) => `${v.path}:${v.line}`).join(", "),
      });
    }
  }
  return results;
}
