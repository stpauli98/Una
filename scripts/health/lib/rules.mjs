// scripts/health/lib/rules.mjs

/**
 * Dvije vrste pravila:
 *  - kind "line":  pattern se traži liniju po liniju; linija koja matchuje
 *    `lineExempt` se preskače. `appliesTo(content)` može ograničiti na fajlove
 *    sa određenim sadržajem. Za multi-line šablone postoji `filePattern`.
 *  - kind "file":  ako fajl matchuje `ifPattern`, mora matchovati i `requirePattern`.
 * `paths` je lista regexa putanja na koje se pravilo odnosi.
 */
export const RULES = [
  {
    id: "R1-anon-insert-select",
    severity: "FAIL",
    kind: "line",
    paths: [/^src\//],
    appliesTo: (content) => content.includes("createPublicClient"),
    filePattern: /\.insert\((?:[^()]|\([^()]*\))*\)\s*[\r\n\s]*\.select\(/,
    message:
      "anon klijent + .insert().select() — RETURNING pada na RLS bez anon SELECT policy (42501). Čitaj id service-role klijentom po confirmation_token-u. Lekcija: bf82018.",
  },
  {
    id: "R2-dayofweek-token-e",
    severity: "FAIL",
    kind: "line",
    paths: [/^src\//],
    pattern: /format(?:InTimeZone)?\([^)]*,\s*["']e["']\s*\)/,
    message:
      'date-fns token "e" je locale-zavisan (ned=1..sub=7) i ne odgovara DB konvenciji 0=ned..6=sub. Koristi sarajevoDayOfWeek(). Lekcija: 53a2f55.',
  },
  {
    id: "R3-bare-getday",
    severity: "FAIL",
    kind: "line",
    paths: [/^src\/lib\/booking\//, /^src\/app\/zakazi\//, /^src\/app\/api\/availability\//],
    pattern: /\.getDay\(\)/,
    lineExempt: /toZonedTime/,
    message:
      "Goli .getDay() koristi server-local TZ (Vercel=UTC). Koristi toZonedTime(date, TZ).getDay() ili sarajevoDayOfWeek().",
  },
  {
    id: "R4-admin-mutation-no-invalidate",
    severity: "FAIL",
    kind: "file",
    paths: [/^src\/app\/admin\/.*actions\.ts$/],
    ifPattern: /\.(update|insert|delete)\(/,
    requirePattern: /updateTag\(|revalidatePath\(/,
    message:
      "Admin akcija mutira podatke a ne invalidira keš — dodaj updateTag(ADMIN_CACHE_TAGS.X) + revalidatePath().",
  },
  {
    id: "R5-unsanitized-console-error",
    severity: "WARN",
    kind: "line",
    paths: [/^src\/app\/.*actions\.ts$/, /^src\/app\/api\//],
    pattern: /console\.error\([^)]*,\s*(?!sanitizeError)[a-zA-Z_]/,
    lineExempt: /sanitizeError/,
    message: "console.error sa dinamičkom vrijednošću bez sanitizeError — PII u Vercel logovima.",
  },
];

export function checkFileAgainstRule(rule, path, content) {
  if (!rule.paths.some((p) => p.test(path))) return [];
  if (rule.appliesTo && !rule.appliesTo(content)) return [];
  const violations = [];
  if (rule.kind === "file") {
    if (rule.ifPattern.test(content) && !rule.requirePattern.test(content)) {
      violations.push({ ruleId: rule.id, path, line: 0, message: rule.message });
    }
    return violations;
  }
  if (rule.filePattern) {
    // Strip single-line comments before testing so comment-only occurrences don't fire.
    const codeOnly = content
      .split("\n")
      .filter((l) => !/^\s*\/\//.test(l))
      .join("\n");
    if (rule.filePattern.test(codeOnly)) {
      violations.push({ ruleId: rule.id, path, line: 0, message: rule.message });
    }
    return violations;
  }
  content.split("\n").forEach((line, i) => {
    if (rule.lineExempt?.test(line)) return;
    if (rule.pattern.test(line)) violations.push({ ruleId: rule.id, path, line: i + 1, message: rule.message });
  });
  return violations;
}
