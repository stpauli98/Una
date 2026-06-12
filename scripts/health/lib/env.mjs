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
