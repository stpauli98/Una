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
