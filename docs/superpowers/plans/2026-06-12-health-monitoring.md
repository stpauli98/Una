# UP Beauty Health Monitoring — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatski tri-slojni nadzor (standardi koda, prod drift, signali ishoda) koji 2× dnevno poredi stvarno stanje sa standardima i šalje email na nmil322@icloud.com samo kad nešto odstupa.

**Architecture:** Čisti Node ESM skriptovi u `scripts/health/` bez novih dependency-ja. Svaka provjera vraća `{ id, layer, status, detail }`; čiste funkcije (poređenja, evaluatori, formatiranje) odvojene su od I/O omotača i unit-testirane u `tests/unit/health/`. Runner `run.mjs` orkestrira slojeve, piše `last-run.json`, šalje Resend email na WARN/FAIL. launchd agent pokreće sve u 09:00 i 18:00.

**Tech Stack:** Node 24 ESM (`.mjs`), Vitest (postojeći), `resend` paket (postojeći), Supabase Management API (read-only), launchd.

**Spec:** `docs/superpowers/specs/2026-06-12-health-monitoring-design.md`

**Radna grana:** `feature/health-monitoring` (već postoji, spec komitovan)

**KRITIČNA PRAVILA ZA IZVOĐAČA:**
- Sve prema produkciji je READ-ONLY. Jedini dozvoljeni "write-shaped" poziv je FK-proba (Task 8) koja po dizajnu ne može upisati red. NIKAD ne pokretati INSERT/UPDATE/DELETE/DDL na prod.
- `.env.local` u repo-u je TEST config (lokalni Docker) — NE koristiti je za prod vrijednosti osim `SUPABASE_ACCESS_TOKEN` (jedino prod-validno u njoj).
- Prod project ref: `ljxggwpzljtjeeljtqts`. Management API zahtijeva `User-Agent` header.

---

## File Structure (pregled)

```
scripts/health/
  run.mjs                  # CLI runner + orkestracija + email okidanje
  generate-expected.mjs    # jednokratni dump prod policy/constraint snapshota
  install-launchd.sh       # instalacija launchd agenta
  uninstall-launchd.sh
  checks/
    code.mjs               # Sloj 1: grep pravila + typecheck/vitest
    prod-drift.mjs         # Sloj 2: policy/constraint/migracije/sanity
    signals.mjs            # Sloj 3: FK-proba, availability, ISR, integritet, slot konzistencija
  lib/
    env.mjs                # parser .env.health
    mgmt-api.mjs           # Management API klijent (sqlQuery, getAnonKey)
    rules.mjs              # definicije grep pravila + čisti engine
    compare.mjs            # čista poređenja (policies/constraints/migrations)
    evaluate.mjs           # čisti evaluatori signala (FK-proba, slots, hours)
    report.mjs             # formatiranje terminal izvještaja + summarize
    email.mjs              # buildEmailHtml (čisto) + sendAlert (Resend/osascript)
  expected/
    policies.json          # generisano Task 5
    constraints.json       # generisano Task 5
tests/unit/health/
  env.test.ts  rules.test.ts  compare.test.ts  evaluate.test.ts  report.test.ts  email.test.ts
.env.health                # gitignoran; SUPABASE_ACCESS_TOKEN, RESEND_API_KEY, ...
```

---

### Task 1: `.env.health` parser + gitignore

**Files:**
- Create: `scripts/health/lib/env.mjs`
- Create: `tests/unit/health/env.test.ts`
- Modify: `.gitignore` (dodaj 2 linije)

- [ ] **Step 1: Failing test**

```ts
// tests/unit/health/env.test.ts
import { describe, it, expect } from "vitest";
import { parseEnvText } from "../../../scripts/health/lib/env.mjs";

describe("parseEnvText", () => {
  it("parses KEY=VALUE lines, ignores comments and blanks", () => {
    const text = "# comment\nA=1\n\nB=hello world\nC=with=equals\n";
    expect(parseEnvText(text)).toEqual({ A: "1", B: "hello world", C: "with=equals" });
  });
  it("trims trailing whitespace and CR (lekcija: \\n u env varijablama)", () => {
    expect(parseEnvText("A=val \r\nB=x\n")).toEqual({ A: "val", B: "x" });
  });
  it("strips surrounding double quotes", () => {
    expect(parseEnvText('A="quoted"\n')).toEqual({ A: "quoted" });
  });
});
```

- [ ] **Step 2: Run** `npx vitest run tests/unit/health/env.test.ts` — očekuj FAIL (modul ne postoji).

- [ ] **Step 3: Implementacija**

```js
// scripts/health/lib/env.mjs
import { readFileSync } from "node:fs";

/** Parsira .env tekst u objekat. Trimuje whitespace/CR, skida dvostruke navodnike. */
export function parseEnvText(text) {
  const out = {};
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i === -1) continue;
    let val = line.slice(i + 1).trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    out[line.slice(0, i).trim()] = val;
  }
  return out;
}

/** Učitava .env.health iz roota repo-a. Baca jasnu grešku ako fajl ne postoji. */
export function loadHealthEnv(rootDir) {
  const path = `${rootDir}/.env.health`;
  let text;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    throw new Error(`Nedostaje ${path} — vidi docs/superpowers/specs/2026-06-12-health-monitoring-design.md (sekcija Kredencijali)`);
  }
  const env = parseEnvText(text);
  for (const key of ["SUPABASE_ACCESS_TOKEN", "SUPABASE_PROJECT_REF", "SITE_URL"]) {
    if (!env[key]) throw new Error(`U .env.health nedostaje ${key}`);
  }
  return env;
}
```

- [ ] **Step 4: Run** `npx vitest run tests/unit/health/env.test.ts` — očekuj PASS (3 testa).

- [ ] **Step 5: Gitignore** — u `.gitignore` dodaj (na kraj):

```
.env.health
scripts/health/last-run.json
```

- [ ] **Step 6: Commit**

```bash
git add scripts/health/lib/env.mjs tests/unit/health/env.test.ts .gitignore
git commit -m "feat(health): .env.health parser sa testovima"
```

---

### Task 2: Result model + terminal report

**Files:**
- Create: `scripts/health/lib/report.mjs`
- Create: `tests/unit/health/report.test.ts`

Result objekat (konvencija kroz cijeli sistem, nema posebnog type fajla — JS):
`{ id: string, layer: "code"|"prod"|"signals", status: "PASS"|"WARN"|"FAIL", detail: string, expected?: string, actual?: string }`

- [ ] **Step 1: Failing test**

```ts
// tests/unit/health/report.test.ts
import { describe, it, expect } from "vitest";
import { summarize, formatReport } from "../../../scripts/health/lib/report.mjs";

const r = (status: string, id = "x") => ({ id, layer: "prod", status, detail: "d" });

describe("summarize", () => {
  it("broji statuse i daje exitCode 1 samo za FAIL", () => {
    expect(summarize([r("PASS"), r("WARN"), r("FAIL")])).toEqual({ pass: 1, warn: 1, fail: 1, exitCode: 1 });
    expect(summarize([r("PASS"), r("WARN")])).toEqual({ pass: 1, warn: 1, fail: 0, exitCode: 0 });
  });
});

describe("formatReport", () => {
  it("FAIL i WARN linije sadrže id, detail i simbol; PASS je sažet", () => {
    const out = formatReport([r("PASS", "ok-check"), r("FAIL", "rls-policy")]);
    expect(out).toContain("✗ [prod] rls-policy");
    expect(out).toContain("1 PASS, 0 WARN, 1 FAIL");
    expect(out).not.toContain("✗ [prod] ok-check");
  });
  it("prikazuje expected/actual kad postoje", () => {
    const out = formatReport([{ id: "m", layer: "prod", status: "FAIL", detail: "d", expected: "A", actual: "B" }]);
    expect(out).toContain("očekivano: A");
    expect(out).toContain("nađeno:    B");
  });
});
```

- [ ] **Step 2: Run** `npx vitest run tests/unit/health/report.test.ts` — FAIL.

- [ ] **Step 3: Implementacija**

```js
// scripts/health/lib/report.mjs
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
```

- [ ] **Step 4: Run** `npx vitest run tests/unit/health/report.test.ts` — PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/health/lib/report.mjs tests/unit/health/report.test.ts
git commit -m "feat(health): result model i terminal report"
```

---

### Task 3: Management API klijent

**Files:**
- Create: `scripts/health/lib/mgmt-api.mjs`

Thin I/O omotač — bez unit testova (testira se integraciono u Task 5/6). VAŽNO: koristi se isključivo za SELECT upite.

- [ ] **Step 1: Implementacija**

```js
// scripts/health/lib/mgmt-api.mjs
const BASE = "https://api.supabase.com/v1";

function headers(token) {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "User-Agent": "up-beauty-health", // Management API vraća 4xx bez User-Agent
  };
}

/** READ-ONLY SQL prema produkciji. Guard odbija sve što nije SELECT/WITH. */
export async function sqlQuery(env, query) {
  const q = query.trim().toLowerCase();
  if (!q.startsWith("select") && !q.startsWith("with")) {
    throw new Error(`sqlQuery dozvoljava samo SELECT/WITH upite, dobio: ${query.slice(0, 40)}`);
  }
  const res = await fetch(`${BASE}/projects/${env.SUPABASE_PROJECT_REF}/database/query`, {
    method: "POST",
    headers: headers(env.SUPABASE_ACCESS_TOKEN),
    body: JSON.stringify({ query }),
  });
  if (!res.ok) throw new Error(`Management API ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

/** Dohvata anon API ključ (javan po dizajnu — ugrađen u svaki browser bundle). */
export async function getAnonKey(env) {
  const res = await fetch(`${BASE}/projects/${env.SUPABASE_PROJECT_REF}/api-keys?reveal=true`, {
    headers: headers(env.SUPABASE_ACCESS_TOKEN),
  });
  if (!res.ok) throw new Error(`api-keys ${res.status}`);
  const keys = await res.json();
  const anon = keys.find((k) => k.name === "anon");
  if (!anon?.api_key) throw new Error("anon ključ nije nađen u api-keys odgovoru");
  return anon.api_key;
}
```

- [ ] **Step 2: Smoke test (read-only, ručno)**

```bash
node -e '
import("./scripts/health/lib/mgmt-api.mjs").then(async (m) => {
  const env = { SUPABASE_ACCESS_TOKEN: process.env.T, SUPABASE_PROJECT_REF: "ljxggwpzljtjeeljtqts" };
  console.log(await m.sqlQuery(env, "select 1 as ok"));
});' 
# pokreni sa: T=$(grep ^SUPABASE_ACCESS_TOKEN .env.local | cut -d= -f2) node -e ...
```
Očekivano: `[ { ok: 1 } ]`. Provjeri i da guard radi: pozovi sa `"delete from x"` → mora baciti grešku PRIJE mreže.

- [ ] **Step 3: Commit**

```bash
git add scripts/health/lib/mgmt-api.mjs
git commit -m "feat(health): Management API klijent sa SELECT-only guardom"
```

---

### Task 4: Sloj 1 — grep pravila + code check

**Files:**
- Create: `scripts/health/lib/rules.mjs`
- Create: `scripts/health/checks/code.mjs`
- Create: `tests/unit/health/rules.test.ts`

- [ ] **Step 1: Failing test**

```ts
// tests/unit/health/rules.test.ts
import { describe, it, expect } from "vitest";
import { checkFileAgainstRule, RULES } from "../../../scripts/health/lib/rules.mjs";

const rule = (id: string) => RULES.find((r) => r.id === id)!;

describe("R1 anon insert+select", () => {
  it("hvata .insert().select() u fajlu koji koristi createPublicClient", () => {
    const content = `import { createPublicClient } from "@/lib/supabase/public";
const x = await anonSb.from("t").insert({a:1}).select("id").single();`;
    const v = checkFileAgainstRule(rule("R1-anon-insert-select"), "src/app/zakazi/actions.ts", content);
    expect(v.length).toBe(1);
  });
  it("ne dira fajl bez createPublicClient", () => {
    const content = `const x = await sb.from("t").insert({a:1}).select("id");`;
    expect(checkFileAgainstRule(rule("R1-anon-insert-select"), "src/app/admin/x.ts", content)).toEqual([]);
  });
  it("hvata i multi-line insert().select() lanac", () => {
    const content = `import { createPublicClient } from "@/lib/supabase/public";
await anonSb.from("appointments").insert({
  a: 1,
}).select("id");`;
    expect(checkFileAgainstRule(rule("R1-anon-insert-select"), "src/x.ts", content).length).toBe(1);
  });
});

describe("R2 date-fns token e", () => {
  it('hvata formatInTimeZone(date, TZ, "e")', () => {
    const content = `const d = Number(formatInTimeZone(start, TZ, "e")) % 7;`;
    expect(checkFileAgainstRule(rule("R2-dayofweek-token-e"), "src/lib/booking/v.ts", content).length).toBe(1);
  });
  it('ne hvata "EEEE" format', () => {
    const content = `formatInTimeZone(d, TZ, "EEEE yyyy-MM-dd");`;
    expect(checkFileAgainstRule(rule("R2-dayofweek-token-e"), "src/x.ts", content)).toEqual([]);
  });
});

describe("R3 goli getDay", () => {
  it("hvata .getDay() bez toZonedTime u booking modulu", () => {
    const content = `const w = date.getDay();`;
    expect(checkFileAgainstRule(rule("R3-bare-getday"), "src/lib/booking/x.ts", content).length).toBe(1);
  });
  it("dozvoljava toZonedTime(date, TZ).getDay()", () => {
    const content = `const w = toZonedTime(date, TZ).getDay();`;
    expect(checkFileAgainstRule(rule("R3-bare-getday"), "src/lib/booking/x.ts", content)).toEqual([]);
  });
  it("ignoriše fajlove van booking putanja", () => {
    const content = `const w = date.getDay();`;
    expect(checkFileAgainstRule(rule("R3-bare-getday"), "src/components/booking/StepCalendar.tsx", content)).toEqual([]);
  });
});

describe("R4 admin mutacija bez invalidacije", () => {
  it("hvata actions.ts sa .update( bez updateTag/revalidatePath", () => {
    const content = `export async function f() { await sb.from("services").update({a:1}).eq("id",1); }`;
    expect(checkFileAgainstRule(rule("R4-admin-mutation-no-invalidate"), "src/app/admin/(protected)/usluge/actions.ts", content).length).toBe(1);
  });
  it("prolazi kad ima updateTag", () => {
    const content = `import { updateTag } from "next/cache";
export async function f() { await sb.from("services").update({a:1}); updateTag("admin:services"); }`;
    expect(checkFileAgainstRule(rule("R4-admin-mutation-no-invalidate"), "src/app/admin/(protected)/usluge/actions.ts", content)).toEqual([]);
  });
});

describe("R5 console.error bez sanitizeError", () => {
  it("WARN za console.error sa varijablom bez sanitizeError", () => {
    const content = `console.error("failed:", err);`;
    const v = checkFileAgainstRule(rule("R5-unsanitized-console-error"), "src/app/zakazi/actions.ts", content);
    expect(v.length).toBe(1);
    expect(rule("R5-unsanitized-console-error").severity).toBe("WARN");
  });
  it("prolazi sa sanitizeError", () => {
    const content = `console.error("failed:", sanitizeError(err));`;
    expect(checkFileAgainstRule(rule("R5-unsanitized-console-error"), "src/app/zakazi/actions.ts", content)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run** `npx vitest run tests/unit/health/rules.test.ts` — FAIL.

- [ ] **Step 3: Implementacija rules engine**

```js
// scripts/health/lib/rules.mjs

/**
 * Dvije vrste pravila:
 *  - kind "line":  pattern se traži liniju po liniju; linija koja matchuje
 *    `lineExempt` se preskače. `appliesTo(content)` može ograničiti na fajlove
 *    sa određenim sadržajem. Za multi-line šablone postoji `filePattern`.
 *  - kind "file":  ako fajl matchuje `ifPattern`, mora matchovati i `requirePattern`.
 * `paths` je lista prefiksa/regexa putanja na koje se pravilo odnosi.
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
    if (rule.filePattern.test(content)) {
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
```

- [ ] **Step 4: Run** `npx vitest run tests/unit/health/rules.test.ts` — PASS. Ako neki regex ne prolazi test, popravi REGEX (ne test).

- [ ] **Step 5: Code check runner**

```js
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
  results.push(runCmd("typecheck", "npx tsc --noEmit", rootDir));
  results.push(runCmd("unit-tests", "npx vitest run --reporter=dot", rootDir));

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
```

- [ ] **Step 6: Ručna provjera nad stvarnim repo-om**

```bash
node -e 'import("./scripts/health/checks/code.mjs").then(async m => {
  const { formatReport } = await import("./scripts/health/lib/report.mjs");
  console.log(formatReport(await m.runCodeChecks(process.cwd())));
})'
```
Očekivano: `typecheck` PASS, `unit-tests` PASS, R1–R4 PASS na trenutnom kodu. R5 može dati WARN — pregledaj listu: ako su svi nalazi legitimni propusti, ostavi (to je smisao provjere); ako je lažna uzbuna, suzi regex i ponovi Step 4.

- [ ] **Step 7: Commit**

```bash
git add scripts/health/lib/rules.mjs scripts/health/checks/code.mjs tests/unit/health/rules.test.ts
git commit -m "feat(health): sloj 1 — grep pravila R1-R5 + typecheck/unit runner"
```

---

### Task 5: Expected snapshots (generate-expected.mjs)

**Files:**
- Create: `scripts/health/generate-expected.mjs`
- Create: `scripts/health/expected/policies.json` (generisan)
- Create: `scripts/health/expected/constraints.json` (generisan)

- [ ] **Step 1: Implementacija generatora (READ-ONLY upiti)**

```js
// scripts/health/generate-expected.mjs
// Jednokratni dump prod RLS/constraint stanja u expected/*.json.
// Pokreće se ručno NAKON što se uvjerimo da je prod stanje ispravno.
import { writeFileSync } from "node:fs";
import { loadHealthEnv } from "./lib/env.mjs";
import { sqlQuery } from "./lib/mgmt-api.mjs";

const TABLES = [
  "appointments", "services", "time_blocks", "working_hours", "settings",
  "gallery_images", "push_subscriptions", "blocked_dates", "training_inquiries",
];

const env = loadHealthEnv(process.cwd());

const policies = await sqlQuery(env, `
  select c.relname as table_name, p.polname as name,
         p.polcmd as cmd, p.polroles::regrole[]::text as roles,
         pg_get_expr(p.polqual, p.polrelid) as using_expr,
         pg_get_expr(p.polwithcheck, p.polrelid) as check_expr
  from pg_policy p join pg_class c on c.oid = p.polrelid
  where c.relname in (${TABLES.map((t) => `'${t}'`).join(",")})
  order by c.relname, p.polname`);

const constraints = await sqlQuery(env, `
  select conname as name, pg_get_constraintdef(oid) as def
  from pg_constraint where conrelid = 'public.appointments'::regclass
  order by conname`);

const triggers = await sqlQuery(env, `
  select tgname as name, pg_get_triggerdef(oid) as def
  from pg_trigger where tgrelid = 'public.appointments'::regclass and not tgisinternal
  order by tgname`);

const rls = await sqlQuery(env, `
  select relname as table_name, relrowsecurity as enabled
  from pg_class where relname in (${TABLES.map((t) => `'${t}'`).join(",")})
  and relkind = 'r' order by relname`);

writeFileSync("scripts/health/expected/policies.json", JSON.stringify({ policies, rls }, null, 2) + "\n");
writeFileSync("scripts/health/expected/constraints.json", JSON.stringify({ constraints, triggers }, null, 2) + "\n");
console.log(`OK: ${policies.length} policy-ja, ${constraints.length} constrainta, ${triggers.length} trigera, ${rls.length} RLS flagova`);
```

- [ ] **Step 2: Pokreni** `node scripts/health/generate-expected.mjs` (zahtijeva .env.health — vidi Task 11 Step 1; ako još ne postoji, napravi ga sada po tom koraku).

- [ ] **Step 3: Verifikuj snapshot ručno.** Otvori `expected/policies.json` i potvrdi da `appointments` ima TAČNO 2 policy-ja (poznato dobro stanje od 2026-06-12):
  - `appointments: admin full` — cmd `*`, roles `{authenticated}`, USING/CHECK `is_admin()`
  - `appointments: anon insert` — cmd `a`, roles `{anon}`, CHECK `((status = 'ceka'::text) AND (confirmation_sent_at IS NULL))`

  I da `constraints.json` sadrži: `appointments_pkey`, `appointments_service_id_fkey`, `appointments_status_check`, `chk_time_range`, `no_overlapping_appointments` + triger `trg_appointments_updated_at`. Ako se NE slaže — STOP, prijavi korisniku (prod je možda već driftovan).

- [ ] **Step 4: Commit**

```bash
git add scripts/health/generate-expected.mjs scripts/health/expected/
git commit -m "feat(health): generator + snapshot očekivanog prod RLS/constraint stanja"
```

---

### Task 6: Sloj 2 — prod drift provjere

**Files:**
- Create: `scripts/health/lib/compare.mjs`
- Create: `scripts/health/checks/prod-drift.mjs`
- Create: `tests/unit/health/compare.test.ts`

- [ ] **Step 1: Failing test**

```ts
// tests/unit/health/compare.test.ts
import { describe, it, expect } from "vitest";
import { diffByKey, compareMigrations } from "../../../scripts/health/lib/compare.mjs";

describe("diffByKey", () => {
  const exp = [{ k: "a", v: 1 }, { k: "b", v: 2 }];
  it("prazno kad je identično", () => {
    expect(diffByKey(exp, [{ k: "a", v: 1 }, { k: "b", v: 2 }], (x) => x.k)).toEqual([]);
  });
  it("prijavljuje missing, unexpected i changed", () => {
    const actual = [{ k: "a", v: 99 }, { k: "c", v: 3 }];
    const diffs = diffByKey(exp, actual, (x) => x.k);
    expect(diffs).toContainEqual({ kind: "changed", key: "a", expected: JSON.stringify({ k: "a", v: 1 }), actual: JSON.stringify({ k: "a", v: 99 }) });
    expect(diffs).toContainEqual({ kind: "missing", key: "b", expected: JSON.stringify({ k: "b", v: 2 }), actual: undefined });
    expect(diffs).toContainEqual({ kind: "unexpected", key: "c", expected: undefined, actual: JSON.stringify({ k: "c", v: 3 }) });
  });
});

describe("compareMigrations", () => {
  it("prazno kad su iste", () => {
    expect(compareMigrations(["20260601000000_a.sql"], [{ version: "20260601000000" }])).toEqual([]);
  });
  it("lokalna migracija koja nije na produkciji = not-pushed (scenario RLS buga)", () => {
    const d = compareMigrations(["20260601000000_a.sql", "20260610000000_b.sql"], [{ version: "20260601000000" }]);
    expect(d).toEqual([{ kind: "not-pushed", key: "20260610000000" }]);
  });
  it("prod migracija koje nema lokalno = unknown-on-prod", () => {
    const d = compareMigrations(["20260601000000_a.sql"], [{ version: "20260601000000" }, { version: "20260611000000" }]);
    expect(d).toEqual([{ kind: "unknown-on-prod", key: "20260611000000" }]);
  });
});
```

- [ ] **Step 2: Run** `npx vitest run tests/unit/health/compare.test.ts` — FAIL.

- [ ] **Step 3: Implementacija**

```js
// scripts/health/lib/compare.mjs

/** Generičko poređenje listi po ključu. Vraća [{kind, key, expected?, actual?}]. */
export function diffByKey(expected, actual, keyFn) {
  const diffs = [];
  const expMap = new Map(expected.map((e) => [keyFn(e), e]));
  const actMap = new Map(actual.map((a) => [keyFn(a), a]));
  for (const [key, e] of expMap) {
    const a = actMap.get(key);
    if (!a) diffs.push({ kind: "missing", key, expected: JSON.stringify(e), actual: undefined });
    else if (JSON.stringify(a) !== JSON.stringify(e))
      diffs.push({ kind: "changed", key, expected: JSON.stringify(e), actual: JSON.stringify(a) });
  }
  for (const [key, a] of actMap) {
    if (!expMap.has(key)) diffs.push({ kind: "unexpected", key, expected: undefined, actual: JSON.stringify(a) });
  }
  return diffs;
}

/** localFiles: imena fajlova iz supabase/migrations; prodRows: [{version}]. */
export function compareMigrations(localFiles, prodRows) {
  const local = new Set(localFiles.map((f) => f.split("_")[0]));
  const prod = new Set(prodRows.map((r) => r.version));
  const diffs = [];
  for (const v of local) if (!prod.has(v)) diffs.push({ kind: "not-pushed", key: v });
  for (const v of prod) if (!local.has(v)) diffs.push({ kind: "unknown-on-prod", key: v });
  return diffs.sort((a, b) => a.key.localeCompare(b.key));
}
```

- [ ] **Step 4: Run** `npx vitest run tests/unit/health/compare.test.ts` — PASS.

- [ ] **Step 5: Prod-drift check runner**

```js
// scripts/health/checks/prod-drift.mjs
import { readFileSync, readdirSync } from "node:fs";
import { sqlQuery } from "../lib/mgmt-api.mjs";
import { diffByKey, compareMigrations } from "../lib/compare.mjs";

const L = "prod";
const policyKey = (p) => `${p.table_name}/${p.name}`;

export async function runProdDriftChecks(rootDir, env) {
  const results = [];
  const expected = JSON.parse(readFileSync(`${rootDir}/scripts/health/expected/policies.json`, "utf8"));
  const expectedCon = JSON.parse(readFileSync(`${rootDir}/scripts/health/expected/constraints.json`, "utf8"));
  const tables = [...new Set(expected.rls.map((r) => r.table_name))];
  const inList = tables.map((t) => `'${t}'`).join(",");

  // 1. RLS policy-ji
  try {
    const actual = await sqlQuery(env, `
      select c.relname as table_name, p.polname as name, p.polcmd as cmd,
             p.polroles::regrole[]::text as roles,
             pg_get_expr(p.polqual, p.polrelid) as using_expr,
             pg_get_expr(p.polwithcheck, p.polrelid) as check_expr
      from pg_policy p join pg_class c on c.oid = p.polrelid
      where c.relname in (${inList}) order by c.relname, p.polname`);
    const diffs = diffByKey(expected.policies, actual, policyKey);
    results.push(diffs.length === 0
      ? { id: "rls-policies", layer: L, status: "PASS", detail: `${actual.length} policy-ja == snapshot` }
      : { id: "rls-policies", layer: L, status: "FAIL", detail: `RLS drift: ${diffs.map((d) => `${d.kind} ${d.key}`).join("; ")}`, expected: diffs[0].expected, actual: diffs[0].actual });
  } catch (e) {
    results.push({ id: "rls-policies", layer: L, status: "FAIL", detail: `provjera nije mogla da se izvrši: ${e.message}` });
  }

  // 2. RLS uključen na svim tabelama
  try {
    const actual = await sqlQuery(env, `
      select relname as table_name, relrowsecurity as enabled
      from pg_class where relname in (${inList}) and relkind = 'r' order by relname`);
    const off = actual.filter((r) => !r.enabled).map((r) => r.table_name);
    results.push(off.length === 0
      ? { id: "rls-enabled", layer: L, status: "PASS", detail: "RLS uključen na svim tabelama" }
      : { id: "rls-enabled", layer: L, status: "FAIL", detail: `RLS ISKLJUČEN na: ${off.join(", ")}` });
  } catch (e) {
    results.push({ id: "rls-enabled", layer: L, status: "FAIL", detail: `provjera nije mogla da se izvrši: ${e.message}` });
  }

  // 3. Constrainti + trigeri na appointments
  try {
    const con = await sqlQuery(env, `select conname as name, pg_get_constraintdef(oid) as def
      from pg_constraint where conrelid = 'public.appointments'::regclass order by conname`);
    const trg = await sqlQuery(env, `select tgname as name, pg_get_triggerdef(oid) as def
      from pg_trigger where tgrelid = 'public.appointments'::regclass and not tgisinternal order by tgname`);
    const diffs = [
      ...diffByKey(expectedCon.constraints, con, (x) => x.name),
      ...diffByKey(expectedCon.triggers, trg, (x) => x.name),
    ];
    results.push(diffs.length === 0
      ? { id: "constraints-triggers", layer: L, status: "PASS", detail: "constrainti i trigeri == snapshot" }
      : { id: "constraints-triggers", layer: L, status: "FAIL", detail: diffs.map((d) => `${d.kind} ${d.key}`).join("; ") });
  } catch (e) {
    results.push({ id: "constraints-triggers", layer: L, status: "FAIL", detail: `provjera nije mogla da se izvrši: ${e.message}` });
  }

  // 4. Migracije: lokalno == prod
  try {
    const localFiles = readdirSync(`${rootDir}/supabase/migrations`).filter((f) => f.endsWith(".sql"));
    const prodRows = await sqlQuery(env, "select version from supabase_migrations.schema_migrations order by version");
    const diffs = compareMigrations(localFiles, prodRows);
    results.push(diffs.length === 0
      ? { id: "migrations-sync", layer: L, status: "PASS", detail: `${localFiles.length} migracija usklađeno` }
      : { id: "migrations-sync", layer: L, status: "FAIL", detail: diffs.map((d) => `${d.kind}: ${d.key}`).join("; ") });
  } catch (e) {
    results.push({ id: "migrations-sync", layer: L, status: "FAIL", detail: `provjera nije mogla da se izvrši: ${e.message}` });
  }

  // 5. Radno vrijeme sanity
  try {
    const rows = await sqlQuery(env, "select day_of_week, open_time, close_time, is_open from working_hours order by day_of_week");
    const problems = [];
    if (rows.length !== 7) problems.push(`${rows.length} redova umjesto 7`);
    for (const r of rows) if (r.is_open && r.open_time >= r.close_time) problems.push(`dan ${r.day_of_week}: open >= close`);
    results.push(problems.length === 0
      ? { id: "working-hours-sanity", layer: L, status: "PASS", detail: "7 redova, open < close" }
      : { id: "working-hours-sanity", layer: L, status: "FAIL", detail: problems.join("; ") });
  } catch (e) {
    results.push({ id: "working-hours-sanity", layer: L, status: "FAIL", detail: `provjera nije mogla da se izvrši: ${e.message}` });
  }

  // 6. Settings sanity
  try {
    const rows = await sqlQuery(env, "select key, value from settings");
    const allowed = new Set(["min_hours_before", "advance_booking_days", "cancellation_hours", "break_between_min"]);
    const bad = rows.filter((r) => !allowed.has(r.key) || !/^\d+$/.test(String(r.value).replace(/"/g, "")));
    results.push(bad.length === 0
      ? { id: "settings-sanity", layer: L, status: "PASS", detail: `${rows.length} ključeva validno` }
      : { id: "settings-sanity", layer: L, status: "WARN", detail: `sumnjivi settings: ${bad.map((b) => b.key).join(", ")}` });
  } catch (e) {
    results.push({ id: "settings-sanity", layer: L, status: "FAIL", detail: `provjera nije mogla da se izvrši: ${e.message}` });
  }

  return results;
}
```

- [ ] **Step 6: Ručna provjera protiv produkcije**

```bash
node -e 'Promise.all([import("./scripts/health/checks/prod-drift.mjs"), import("./scripts/health/lib/env.mjs"), import("./scripts/health/lib/report.mjs")]).then(async ([m, e, r]) => {
  console.log(r.formatReport(await m.runProdDriftChecks(process.cwd(), e.loadHealthEnv(process.cwd()))));
})'
```
Očekivano: svih 6 provjera PASS (snapshot je upravo generisan sa istog stanja).

- [ ] **Step 7: Commit**

```bash
git add scripts/health/lib/compare.mjs scripts/health/checks/prod-drift.mjs tests/unit/health/compare.test.ts
git commit -m "feat(health): sloj 2 — prod drift (RLS, constrainti, migracije, sanity)"
```

---

### Task 7: Sloj 3 — čisti evaluatori signala

**Files:**
- Create: `scripts/health/lib/evaluate.mjs`
- Create: `tests/unit/health/evaluate.test.ts`

- [ ] **Step 1: Failing test**

```ts
// tests/unit/health/evaluate.test.ts
import { describe, it, expect } from "vitest";
import { evaluateFkProbe, evaluateSlotsShape, slotWithinHours, evaluateBookingAge } from "../../../scripts/health/lib/evaluate.mjs";

describe("evaluateFkProbe", () => {
  it("23503 (FK violation) = PASS — cijeli put upisa zdrav", () => {
    const r = evaluateFkProbe(409, { code: "23503", message: "violates foreign key" });
    expect(r.status).toBe("PASS");
  });
  it("42501 = FAIL — RLS polomljen (lekcija bf82018)", () => {
    const r = evaluateFkProbe(403, { code: "42501", message: "row-level security" });
    expect(r.status).toBe("FAIL");
    expect(r.detail).toContain("RLS");
  });
  it("401 = FAIL — anon ključ nevalidan", () => {
    expect(evaluateFkProbe(401, { message: "Invalid API key" }).status).toBe("FAIL");
  });
  it("neočekivan uspjeh (201) = FAIL — proba NE smije proći", () => {
    expect(evaluateFkProbe(201, {}).status).toBe("FAIL");
  });
});

describe("evaluateSlotsShape", () => {
  it("validan odgovor sa slotovima = PASS", () => {
    const r = evaluateSlotsShape("2026-06-13", 200, { slots: [{ start: "2026-06-13T03:00:00.000Z", end: "2026-06-13T04:00:00.000Z" }] });
    expect(r.ok).toBe(true);
    expect(r.count).toBe(1);
  });
  it("ne-200 ili pogrešan oblik = not ok", () => {
    expect(evaluateSlotsShape("2026-06-13", 500, {}).ok).toBe(false);
    expect(evaluateSlotsShape("2026-06-13", 200, { slots: [{ start: "x" }] }).ok).toBe(false);
  });
});

describe("slotWithinHours", () => {
  // subota 13.06.2026. 05:00 Sarajevo = 03:00Z; radno 05:00-20:00 — stvarni bug scenario
  const hours = { 6: { open: "05:00", close: "20:00", isOpen: true } };
  it("slot na granici otvaranja prolazi", () => {
    expect(slotWithinHours("2026-06-13T03:00:00.000Z", "2026-06-13T04:30:00.000Z", hours)).toBe(true);
  });
  it("slot prije otvaranja pada", () => {
    expect(slotWithinHours("2026-06-13T02:00:00.000Z", "2026-06-13T03:00:00.000Z", hours)).toBe(false);
  });
  it("zatvoren dan pada", () => {
    expect(slotWithinHours("2026-06-13T03:00:00.000Z", "2026-06-13T04:00:00.000Z", { 6: { open: "05:00", close: "20:00", isOpen: false } })).toBe(false);
  });
});

describe("evaluateBookingAge", () => {
  it("ispod praga = PASS, iznad = WARN", () => {
    expect(evaluateBookingAge(3, 14).status).toBe("PASS");
    expect(evaluateBookingAge(20, 14).status).toBe("WARN");
  });
  it("null (nijedna javna rezervacija) = WARN", () => {
    expect(evaluateBookingAge(null, 14).status).toBe("WARN");
  });
});
```

- [ ] **Step 2: Run** `npx vitest run tests/unit/health/evaluate.test.ts` — FAIL.

- [ ] **Step 3: Implementacija**

```js
// scripts/health/lib/evaluate.mjs
import { formatInTimeZone, toZonedTime } from "date-fns-tz";

const TZ = "Europe/Sarajevo";

/** FK-proba: POST sa nepostojećim service_id. Jedini zdrav ishod je FK violation. */
export function evaluateFkProbe(httpStatus, body) {
  const code = body?.code;
  if (code === "23503")
    return { status: "PASS", detail: "put upisa zdrav (gateway → anon ključ → RLS → FK)" };
  if (code === "42501")
    return { status: "FAIL", detail: `RLS odbija anon INSERT — isti mehanizam kao bug bf82018: ${body?.message ?? ""}` };
  if (httpStatus === 401)
    return { status: "FAIL", detail: "anon ključ odbijen na gateway-u (401) — ključ rotiran/nevalidan?" };
  if (httpStatus >= 200 && httpStatus < 300)
    return { status: "FAIL", detail: "proba sa nepostojećim service_id je PROŠLA — FK constraint nedostaje?!" };
  return { status: "FAIL", detail: `neočekivan odgovor ${httpStatus}: ${JSON.stringify(body).slice(0, 200)}` };
}

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

export function evaluateSlotsShape(dateStr, httpStatus, body) {
  if (httpStatus !== 200) return { ok: false, count: 0, detail: `${dateStr}: HTTP ${httpStatus}` };
  if (!Array.isArray(body?.slots)) return { ok: false, count: 0, detail: `${dateStr}: nema slots niza` };
  for (const s of body.slots) {
    if (!ISO.test(s?.start ?? "") || !ISO.test(s?.end ?? ""))
      return { ok: false, count: 0, detail: `${dateStr}: slot bez validnog start/end` };
  }
  return { ok: true, count: body.slots.length, detail: `${dateStr}: ${body.slots.length} slotova` };
}

/** hours: { [0..6]: {open:"HH:mm", close:"HH:mm", isOpen} } — ista konvencija kao DB (0=ned). */
export function slotWithinHours(startIso, endIso, hours) {
  const start = new Date(startIso);
  const weekday = toZonedTime(start, TZ).getDay();
  const h = hours[weekday];
  if (!h || !h.isOpen) return false;
  const s = formatInTimeZone(start, TZ, "HH:mm");
  const e = formatInTimeZone(new Date(endIso), TZ, "HH:mm");
  return s >= h.open && e <= h.close;
}

export function evaluateBookingAge(daysSince, thresholdDays) {
  if (daysSince === null)
    return { status: "WARN", detail: "nijedna javna rezervacija u bazi (confirmation_token is null svuda)" };
  if (daysSince > thresholdDays)
    return { status: "WARN", detail: `zadnja javna rezervacija prije ${Math.round(daysSince)} dana (prag ${thresholdDays})` };
  return { status: "PASS", detail: `zadnja javna rezervacija prije ${Math.round(daysSince)} dana` };
}
```

- [ ] **Step 4: Run** `npx vitest run tests/unit/health/evaluate.test.ts` — PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/health/lib/evaluate.mjs tests/unit/health/evaluate.test.ts
git commit -m "feat(health): čisti evaluatori signala (FK-proba, slots, hours, booking age)"
```

---

### Task 8: Sloj 3 — signals check runner (I/O)

**Files:**
- Create: `scripts/health/checks/signals.mjs`

- [ ] **Step 1: Implementacija**

```js
// scripts/health/checks/signals.mjs
import { sqlQuery, getAnonKey } from "../lib/mgmt-api.mjs";
import { evaluateFkProbe, evaluateSlotsShape, slotWithinHours, evaluateBookingAge } from "../lib/evaluate.mjs";
import { formatInTimeZone } from "date-fns-tz";

const L = "signals";
const TZ = "Europe/Sarajevo";

function guard(id, fn) {
  return fn().catch((e) => ({ id, layer: L, status: "FAIL", detail: `provjera nije mogla da se izvrši: ${e.message}` }));
}

/** Datum string za N dana unaprijed, u Sarajevo zoni (podne-anchor zbog DST). */
function dateStrPlus(days) {
  const noonToday = new Date(`${formatInTimeZone(new Date(), TZ, "yyyy-MM-dd")}T12:00:00Z`);
  return formatInTimeZone(new Date(noonToday.getTime() + days * 86_400_000), TZ, "yyyy-MM-dd");
}

export async function runSignalChecks(env) {
  const supabaseUrl = `https://${env.SUPABASE_PROJECT_REF}.supabase.co`;
  const site = env.SITE_URL.replace(/\/$/, "");
  const results = [];

  // 1. FK-proba upisa — JEDINI write-shaped poziv; service_id=999999 ne postoji
  //    pa FK violation garantuje da se ništa ne upisuje i nikakav email ne šalje.
  results.push(await guard("fk-write-probe", async () => {
    const anon = await getAnonKey(env);
    const res = await fetch(`${supabaseUrl}/rest/v1/appointments`, {
      method: "POST",
      headers: { apikey: anon, Authorization: `Bearer ${anon}`, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({
        service_id: 999999, client_name: "[HEALTH-PROBE]", client_phone: "+38765000000",
        start_time: "2030-01-01T10:00:00Z", end_time: "2030-01-01T11:00:00Z",
        status: "ceka", confirmation_token: crypto.randomUUID(),
      }),
    });
    const body = await res.json().catch(() => ({}));
    const ev = evaluateFkProbe(res.status, body);
    return { id: "fk-write-probe", layer: L, ...ev };
  }));

  // 2.+6. Availability oblik za narednih 7 dana + slot konzistencija za sutra
  results.push(...await guard("availability-7d", async () => {
    const svc = await sqlQuery(env, "select id from services where bookable and active and duration_min is not null order by id limit 1");
    if (!svc.length) return [{ id: "availability-7d", layer: L, status: "FAIL", detail: "nijedna bookable usluga u bazi" }];
    const serviceId = svc[0].id;
    const hoursRows = await sqlQuery(env, "select day_of_week, open_time, close_time, is_open from working_hours");
    const hours = Object.fromEntries(hoursRows.map((r) => [r.day_of_week, { open: r.open_time.slice(0, 5), close: r.close_time.slice(0, 5), isOpen: r.is_open }]));

    const out = [];
    let total = 0;
    let shapeProblem = null;
    let tomorrowSlots = [];
    for (let d = 1; d <= 7; d++) {
      const dateStr = dateStrPlus(d);
      const res = await fetch(`${site}/api/availability?date=${dateStr}&service_id=${serviceId}`);
      const body = await res.json().catch(() => ({}));
      const ev = evaluateSlotsShape(dateStr, res.status, body);
      if (!ev.ok && !shapeProblem) shapeProblem = ev.detail;
      total += ev.count;
      if (d === 1 && ev.ok) tomorrowSlots = body.slots;
    }
    out.push(shapeProblem
      ? { id: "availability-7d", layer: L, status: "FAIL", detail: shapeProblem }
      : total === 0
        ? { id: "availability-7d", layer: L, status: "WARN", detail: "0 slotova u narednih 7 dana (popunjeno ili bug?)" }
        : { id: "availability-7d", layer: L, status: "PASS", detail: `${total} slotova u narednih 7 dana` });

    const bad = tomorrowSlots.filter((s) => !slotWithinHours(s.start, s.end, hours));
    out.push(bad.length === 0
      ? { id: "slot-consistency", layer: L, status: "PASS", detail: `svi sutrašnji slotovi (${tomorrowSlots.length}) unutar radnog vremena` }
      : { id: "slot-consistency", layer: L, status: "FAIL", detail: "API nudi slotove van radnog vremena — generisanje i validacija se razilaze (lekcija 53a2f55)", actual: bad.map((s) => s.start).join(", ") });
    return out;
  }).then((r) => (Array.isArray(r) ? r : [r])));

  // 3. ISR sadržaj
  results.push(await guard("isr-content", async () => {
    const cjen = await fetch(`${site}/cjenovnik`).then((r) => r.text());
    const uslg = await fetch(`${site}/usluge`).then((r) => r.text());
    const zakazi = await fetch(`${site}/zakazi`);
    const home = await fetch(site);
    const problems = [];
    if (!cjen.includes("KM")) problems.push("/cjenovnik bez cijena");
    if ((uslg.match(/<h3/g) ?? []).length < 5) problems.push("/usluge ima <5 usluga");
    if (zakazi.status !== 200) problems.push(`/zakazi HTTP ${zakazi.status}`);
    if (home.status !== 200) problems.push(`/ HTTP ${home.status}`);
    return problems.length === 0
      ? { id: "isr-content", layer: L, status: "PASS", detail: "sve javne stranice renderuju sadržaj" }
      : { id: "isr-content", layer: L, status: "FAIL", detail: problems.join("; ") };
  }));

  // 4. Starost zadnje javne rezervacije
  results.push(await guard("public-booking-age", async () => {
    const rows = await sqlQuery(env, "select extract(epoch from (now() - max(created_at)))/86400.0 as days from appointments where confirmation_token is not null");
    const days = rows[0]?.days === null ? null : Number(rows[0].days);
    return { id: "public-booking-age", layer: L, ...evaluateBookingAge(days, 14) };
  }));

  // 5. Integritet podataka
  results.push(await guard("data-integrity", async () => {
    const overlap = await sqlQuery(env, `
      select count(*)::int as n from appointments a join appointments b
      on a.id < b.id and tstzrange(a.start_time, a.end_time) && tstzrange(b.start_time, b.end_time)
      where a.status in ('ceka','potvrdjen') and b.status in ('ceka','potvrdjen')`);
    const outside = await sqlQuery(env, `
      select count(*)::int as n from appointments ap join working_hours wh
      on wh.day_of_week = extract(dow from ap.start_time at time zone 'Europe/Sarajevo')::int
      where ap.status in ('ceka','potvrdjen') and ap.start_time > now()
      and (not wh.is_open
           or (ap.start_time at time zone 'Europe/Sarajevo')::time < wh.open_time
           or (ap.end_time at time zone 'Europe/Sarajevo')::time > wh.close_time)`);
    const stale = await sqlQuery(env, `
      select count(*)::int as n from appointments
      where status = 'ceka' and created_at < now() - interval '3 days' and start_time > now()`);
    const problems = [];
    if (overlap[0].n > 0) problems.push(`${overlap[0].n} preklapanja aktivnih termina`);
    if (outside[0].n > 0) problems.push(`${outside[0].n} budućih termina van radnog vremena`);
    if (problems.length) return { id: "data-integrity", layer: L, status: "FAIL", detail: problems.join("; ") };
    if (stale[0].n > 0) return { id: "data-integrity", layer: L, status: "WARN", detail: `${stale[0].n} 'ceka' termina starijih od 3 dana — Una zaboravila potvrditi?` };
    return { id: "data-integrity", layer: L, status: "PASS", detail: "bez preklapanja, van-radnog-vremena i ustajalih 'ceka'" };
  }));

  return results.flat();
}
```

- [ ] **Step 2: Ručna provjera protiv produkcije**

```bash
node -e 'Promise.all([import("./scripts/health/checks/signals.mjs"), import("./scripts/health/lib/env.mjs"), import("./scripts/health/lib/report.mjs")]).then(async ([m, e, r]) => {
  console.log(r.formatReport(await m.runSignalChecks(e.loadHealthEnv(process.cwd()))));
})'
```
Očekivano: `fk-write-probe` PASS (FK violation), `availability-7d` PASS ili WARN, `slot-consistency` PASS, `isr-content` PASS, `public-booking-age` PASS (zadnja javna rezervacija 2026-06-12), `data-integrity` PASS ili WARN. NAKON pokretanja verifikuj da proba NIJE ostavila red: upit `select count(*) from appointments where client_name = '[HEALTH-PROBE]'` mora vratiti 0.

- [ ] **Step 3: Commit**

```bash
git add scripts/health/checks/signals.mjs
git commit -m "feat(health): sloj 3 — FK-proba, availability, ISR, integritet, slot konzistencija"
```

---

### Task 9: Email alert (Resend + osascript fallback)

**Files:**
- Create: `scripts/health/lib/email.mjs`
- Create: `tests/unit/health/email.test.ts`

- [ ] **Step 1: Failing test**

```ts
// tests/unit/health/email.test.ts
import { describe, it, expect } from "vitest";
import { buildEmailSubject, buildEmailHtml } from "../../../scripts/health/lib/email.mjs";

const results = [
  { id: "ok", layer: "code", status: "PASS", detail: "fino" },
  { id: "rls-policies", layer: "prod", status: "FAIL", detail: "RLS drift: changed appointments/anon insert", expected: "X", actual: "Y" },
  { id: "booking-age", layer: "signals", status: "WARN", detail: "18 dana" },
];

describe("buildEmailSubject", () => {
  it("broji FAIL i WARN", () => {
    expect(buildEmailSubject(results, new Date("2026-06-12T10:00:00Z"))).toBe("[UP Health] 1 FAIL, 1 WARN — 12.06.2026 12:00");
  });
});

describe("buildEmailHtml", () => {
  it("sadrži samo WARN/FAIL redove, escape-uje HTML", () => {
    const html = buildEmailHtml([...results, { id: "x", layer: "prod", status: "FAIL", detail: "<script>alert(1)</script>" }]);
    expect(html).toContain("rls-policies");
    expect(html).toContain("booking-age");
    expect(html).not.toContain(">ok<");
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;");
  });
});
```

- [ ] **Step 2: Run** `npx vitest run tests/unit/health/email.test.ts` — FAIL.

- [ ] **Step 3: Implementacija**

```js
// scripts/health/lib/email.mjs
import { execFileSync } from "node:child_process";
import { formatInTimeZone } from "date-fns-tz";

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function buildEmailSubject(results, now) {
  const fail = results.filter((r) => r.status === "FAIL").length;
  const warn = results.filter((r) => r.status === "WARN").length;
  return `[UP Health] ${fail} FAIL, ${warn} WARN — ${formatInTimeZone(now, "Europe/Sarajevo", "dd.MM.yyyy HH:mm")}`;
}

export function buildEmailHtml(results) {
  const bad = results.filter((r) => r.status !== "PASS");
  const rows = bad.map((r) => `
    <tr>
      <td style="padding:6px 10px;border:1px solid #ddd;color:${r.status === "FAIL" ? "#c0392b" : "#b07d12"};font-weight:bold">${r.status}</td>
      <td style="padding:6px 10px;border:1px solid #ddd">${esc(r.layer)}</td>
      <td style="padding:6px 10px;border:1px solid #ddd"><code>${esc(r.id)}</code></td>
      <td style="padding:6px 10px;border:1px solid #ddd">${esc(r.detail)}${r.expected ? `<br><small>očekivano: <code>${esc(r.expected)}</code><br>nađeno: <code>${esc(r.actual ?? "")}</code></small>` : ""}</td>
    </tr>`).join("");
  return `<h2>UP Beauty Health — odstupanja</h2>
<table style="border-collapse:collapse;font-family:sans-serif;font-size:14px">
<tr><th style="padding:6px 10px;border:1px solid #ddd">Status</th><th style="padding:6px 10px;border:1px solid #ddd">Sloj</th><th style="padding:6px 10px;border:1px solid #ddd">Provjera</th><th style="padding:6px 10px;border:1px solid #ddd">Detalj</th></tr>
${rows}
</table>
<p style="font-family:sans-serif;font-size:13px;color:#666">Ručni rerun: <code>cd up-beauty &amp;&amp; npm run health</code></p>`;
}

/** Šalje email ako je RESEND_API_KEY dostupan; inače macOS notifikacija. */
export async function sendAlert(env, results, now = new Date()) {
  const subject = buildEmailSubject(results, now);
  if (env.RESEND_API_KEY && env.HEALTH_ALERT_EMAIL) {
    const { Resend } = await import("resend");
    const resend = new Resend(env.RESEND_API_KEY);
    const { error } = await resend.emails.send({
      from: env.RESEND_FROM_EMAIL ?? "rezervacije@upmakeup.ba",
      to: env.HEALTH_ALERT_EMAIL,
      subject,
      html: buildEmailHtml(results),
    });
    if (!error) return { sent: "email" };
    console.error("Resend greška:", error.message ?? error);
  }
  try {
    execFileSync("osascript", ["-e", `display notification ${JSON.stringify(subject)} with title "UP Health"`]);
    return { sent: "notification" };
  } catch {
    return { sent: "none" };
  }
}
```

- [ ] **Step 4: Run** `npx vitest run tests/unit/health/email.test.ts` — PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/health/lib/email.mjs tests/unit/health/email.test.ts
git commit -m "feat(health): email alert (Resend) sa osascript fallbackom"
```

---

### Task 10: Runner `run.mjs` + npm skripte

**Files:**
- Create: `scripts/health/run.mjs`
- Modify: `package.json` (scripts sekcija)

- [ ] **Step 1: Implementacija**

```js
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
```

- [ ] **Step 2: package.json scripts** — dodaj u `"scripts"`:

```json
"health": "node scripts/health/run.mjs",
"health:code": "node scripts/health/run.mjs code",
"health:prod": "node scripts/health/run.mjs prod",
"health:signals": "node scripts/health/run.mjs signals"
```

- [ ] **Step 3: Puni ručni run** — `npm run health`. Očekivano: svi slojevi se izvrše (~60-90s zbog typecheck+vitest), izvještaj u terminalu, `scripts/health/last-run.json` napisan, exit code 0 (uz moguće WARN → tada stiže i notifikacija/email).

- [ ] **Step 4: Test FAIL puta bez diranja produkcije** — privremeno u `expected/policies.json` promijeni jedno slovo u `check_expr` nekog policy-ja, pokreni `npm run health:prod` → mora dati FAIL + (bez RESEND ključa) macOS notifikaciju + exit 1. Vrati fajl: `git checkout scripts/health/expected/policies.json`.

- [ ] **Step 5: Commit**

```bash
git add scripts/health/run.mjs package.json
git commit -m "feat(health): runner sa slojevima, last-run.json i alert okidanjem"
```

---

### Task 11: `.env.health` + launchd automatika

**Files:**
- Create: `.env.health` (NE komituje se — gitignoran od Task 1)
- Create: `scripts/health/install-launchd.sh`
- Create: `scripts/health/uninstall-launchd.sh`

- [ ] **Step 1: Napravi `.env.health` u rootu repo-a** (vrijednosti: token prepiši iz `.env.local`; RESEND_API_KEY ostavi prazan dok ga korisnik ne da — sistem tada koristi macOS notifikacije):

```
SUPABASE_ACCESS_TOKEN=<prepiši iz .env.local>
SUPABASE_PROJECT_REF=ljxggwpzljtjeeljtqts
SITE_URL=https://www.upmakeup.ba
HEALTH_ALERT_EMAIL=nmil322@icloud.com
RESEND_API_KEY=
RESEND_FROM_EMAIL=rezervacije@upmakeup.ba
```

- [ ] **Step 2: install skripta**

```bash
#!/bin/bash
# scripts/health/install-launchd.sh — instalira launchd agent (09:00 i 18:00)
set -euo pipefail
REPO_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
PLIST=~/Library/LaunchAgents/com.nextpixel.upbeauty-health.plist
NODE_BIN="$(command -v node)"

cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.nextpixel.upbeauty-health</string>
  <key>ProgramArguments</key>
  <array>
    <string>${NODE_BIN}</string>
    <string>${REPO_DIR}/scripts/health/run.mjs</string>
  </array>
  <key>WorkingDirectory</key><string>${REPO_DIR}</string>
  <key>StartCalendarInterval</key>
  <array>
    <dict><key>Hour</key><integer>9</integer><key>Minute</key><integer>0</integer></dict>
    <dict><key>Hour</key><integer>18</integer><key>Minute</key><integer>0</integer></dict>
  </array>
  <key>StandardOutPath</key><string>${HOME}/Library/Logs/upbeauty-health.log</string>
  <key>StandardErrorPath</key><string>${HOME}/Library/Logs/upbeauty-health.log</string>
</dict>
</plist>
EOF

launchctl unload "$PLIST" 2>/dev/null || true
launchctl load "$PLIST"
echo "Instalirano. Test: launchctl start com.nextpixel.upbeauty-health && tail -f ~/Library/Logs/upbeauty-health.log"
```

```bash
#!/bin/bash
# scripts/health/uninstall-launchd.sh
set -euo pipefail
PLIST=~/Library/LaunchAgents/com.nextpixel.upbeauty-health.plist
launchctl unload "$PLIST" 2>/dev/null || true
rm -f "$PLIST"
echo "Uklonjeno."
```

- [ ] **Step 3:** `chmod +x scripts/health/install-launchd.sh scripts/health/uninstall-launchd.sh`

- [ ] **Step 4: Instaliraj i verifikuj**

```bash
./scripts/health/install-launchd.sh
launchctl start com.nextpixel.upbeauty-health
sleep 120 && tail -20 ~/Library/Logs/upbeauty-health.log
```
Očekivano: u logu kompletan izvještaj (svi slojevi). NAPOMENA: launchd ne učitava shell profil — zato plist koristi apsolutnu putanju do node binarne (provjeri da `npx` pozivi u code.mjs rade i u tom kontekstu; ako `npx` nije na PATH-u, u code.mjs zamijeni `npx tsc` → `node_modules/.bin/tsc` i `npx vitest` → `node_modules/.bin/vitest`).

- [ ] **Step 5: Commit**

```bash
git add scripts/health/install-launchd.sh scripts/health/uninstall-launchd.sh
git commit -m "feat(health): launchd automatika 2x dnevno (09h/18h)"
```

---

### Task 12: Finalna verifikacija + merge

- [ ] **Step 1:** `npm test` — svi unit testovi (postojeći + novih ~20) PASS.
- [ ] **Step 2:** `npm run typecheck` — čisto. (`npx eslint scripts/health tests/unit/health` — čisto.)
- [ ] **Step 3:** `npm run health` — pun izvještaj, exit 0 (WARN-ovi dozvoljeni, FAIL ne).
- [ ] **Step 4:** Provjeri da `git status` ne pokazuje `.env.health` ni `last-run.json` (gitignore radi).
- [ ] **Step 5:** Pitaj korisnika za odobrenje merge-a u `main` (NE pushovati bez odobrenja):

```bash
git checkout main && git merge --no-ff feature/health-monitoring -m "Merge feature/health-monitoring: tri-slojni health monitoring sistem"
git push origin main
```
Napomena: merge u main NE deploya ništa rizično — `scripts/` ne ulazi u Next build; jedina promjena aplikativnog koda je nikakva (sve je u scripts/, tests/, docs/, package.json scripts).

- [ ] **Step 6:** Podsjeti korisnika: dostaviti `RESEND_API_KEY` (Vercel dashboard → up-beauty → Settings → Environment Variables) i upisati ga u `.env.health` — do tada alerti idu kao macOS notifikacije.

---

## Self-review (urađen pri pisanju)

- **Spec coverage:** Sloj 1 → Task 4; Sloj 2 → Tasks 5-6; Sloj 3 (svih 6 provjera, uklj. slot konzistenciju #6) → Tasks 7-8; email → Task 9; launchd → Task 11; `.env.health` → Tasks 1, 11; testiranje → testovi u svakom tasku; "tišina nikad ne znači nije provjereno" → guard() + runner catch.
- **Bez placeholder-a:** svaki korak ima kompletan kod/komandu.
- **Konzistentnost imena:** `runCodeChecks(rootDir)`, `runProdDriftChecks(rootDir, env)`, `runSignalChecks(env)`, `formatReport`, `summarize`, `sendAlert`, `loadHealthEnv`, `sqlQuery`, `getAnonKey` — provjereno kroz taskove.
- **Odstupanje od speca (svjesno):** spec pominje testiranje slojeva 2-3 protiv lokalnog Dockera namjernim lomljenjem policy-ja; plan to postiže jeftinije — FAIL put se testira izmjenom snapshot fajla (Task 10 Step 4), bez diranja bilo koje baze. Čisti evaluatori pokrivaju logiku unit testovima.
