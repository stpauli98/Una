// scripts/health/checks/code.mjs
import { execSync, execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { RULES, checkFileAgainstRule } from "../lib/rules.mjs";

function runCmd(id, cmd, rootDir) {
  try {
    execSync(cmd, { cwd: rootDir, stdio: "pipe", timeout: 300_000 });
    return { id, layer: "code", status: "PASS", detail: cmd };
  } catch (e) {
    const out = `${e.stdout ?? ""}${e.stderr ?? ""}`.slice(-400);
    return { id, layer: "code", status: "FAIL", detail: `${cmd} pao`, actual: out };
  }
}

export async function runCodeChecks(rootDir) {
  const results = [];
  results.push(runCmd("typecheck", "node_modules/.bin/tsc --noEmit", rootDir));
  results.push(runCmd("unit-tests", "node_modules/.bin/vitest run --reporter=dot", rootDir));

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
