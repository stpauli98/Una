const SYMBOL = { PASS: "✓", WARN: "⚠", FAIL: "✗" };

export function summarize(results) {
  const count = (s) => results.filter((r) => r.status === s).length;
  const fail = count("FAIL");
  return { pass: count("PASS"), warn: count("WARN"), fail, exitCode: fail > 0 ? 1 : 0 };
}

export function formatReport(results) {
  const lines = [];
  for (const r of results) {
    if (r.status === "PASS") {
      lines.push(`${SYMBOL.PASS} [${r.layer}] ${r.id}`);
      continue;
    }
    lines.push(`${SYMBOL[r.status]} [${r.layer}] ${r.id} — ${r.detail}`);
    if (r.expected !== undefined) lines.push(`    očekivano: ${r.expected}`);
    if (r.actual !== undefined) lines.push(`    nađeno:    ${r.actual}`);
  }
  const s = summarize(results);
  lines.push("");
  lines.push(`${s.pass} PASS, ${s.warn} WARN, ${s.fail} FAIL`);
  return lines.join("\n");
}
