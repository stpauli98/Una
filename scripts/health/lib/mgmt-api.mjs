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
  let q = query.trim();
  // Strip repeated leading SQL comments before the guard check
  let prev;
  do {
    prev = q;
    q = q.replace(/^(--[^\n]*\n|\/\*[\s\S]*?\*\/)\s*/g, "");
  } while (q !== prev);
  q = q.trimStart().toLowerCase();
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
  if (!res.ok) throw new Error(`api-keys ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const keys = await res.json();
  const anon = keys.find((k) => k.name === "anon");
  if (!anon?.api_key) throw new Error("anon ključ nije nađen u api-keys odgovoru");
  return anon.api_key;
}
