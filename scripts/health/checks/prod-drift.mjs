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
