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
