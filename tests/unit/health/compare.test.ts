import { describe, it, expect } from "vitest";
import { diffByKey, compareMigrations } from "../../../scripts/health/lib/compare.mjs";

describe("diffByKey", () => {
  const exp = [{ k: "a", v: 1 }, { k: "b", v: 2 }];
  it("prazno kad je identično", () => {
    expect(diffByKey(exp, [{ k: "a", v: 1 }, { k: "b", v: 2 }], (x: { k: string; v: number }) => x.k)).toEqual([]);
  });
  it("prijavljuje missing, unexpected i changed", () => {
    const actual = [{ k: "a", v: 99 }, { k: "c", v: 3 }];
    const diffs = diffByKey(exp, actual, (x: { k: string; v: number }) => x.k);
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
