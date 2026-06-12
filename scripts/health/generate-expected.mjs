// scripts/health/generate-expected.mjs
// Jednokratni dump prod RLS/constraint stanja u expected/*.json.
// Pokreće se ručno NAKON što se uvjerimo da je prod stanje ispravno.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { loadHealthEnv } from "./lib/env.mjs";
import { sqlQuery } from "./lib/mgmt-api.mjs";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

const TABLES = [
  "appointments", "services", "time_blocks", "working_hours", "settings",
  "gallery_images", "push_subscriptions", "blocked_dates", "training_inquiries",
];

const env = loadHealthEnv(rootDir);

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

if (policies.length === 0 || constraints.length === 0 || rls.length === 0) {
  console.error("GREŠKA: prazan rezultat iz Management API — snapshot NIJE prepisan");
  process.exit(1);
}

writeFileSync(`${rootDir}/scripts/health/expected/policies.json`, JSON.stringify({ policies, rls }, null, 2) + "\n");
writeFileSync(`${rootDir}/scripts/health/expected/constraints.json`, JSON.stringify({ constraints, triggers }, null, 2) + "\n");
console.log(`OK: ${policies.length} policy-ja, ${constraints.length} constrainta, ${triggers.length} trigera, ${rls.length} RLS flagova`);
