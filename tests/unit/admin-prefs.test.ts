import { describe, it, expect } from "vitest";
import {
  parseTerminiPrefs,
  serializeTerminiPrefs,
  TERMINI_PREFS_COOKIE,
  DASHBOARD_DATE_COOKIE,
  computeDefaultSort,
  resolveTerminiPrefs,
  type TerminiPrefs,
} from "@/lib/utils/admin-prefs";

describe("TERMINI_PREFS_COOKIE", () => {
  it("has the expected name", () => {
    expect(TERMINI_PREFS_COOKIE).toBe("up-admin-termini-prefs");
  });
});

describe("DASHBOARD_DATE_COOKIE", () => {
  it("has the expected name", () => {
    expect(DASHBOARD_DATE_COOKIE).toBe("up-admin-dashboard-date");
  });
});

describe("parseTerminiPrefs", () => {
  it("returns empty prefs for undefined input", () => {
    expect(parseTerminiPrefs(undefined)).toEqual({});
  });

  it("returns empty prefs for malformed JSON", () => {
    expect(parseTerminiPrefs("not-json")).toEqual({});
  });

  it("returns empty prefs for non-object JSON", () => {
    expect(parseTerminiPrefs("[]")).toEqual({});
    expect(parseTerminiPrefs("42")).toEqual({});
    expect(parseTerminiPrefs("null")).toEqual({});
  });

  it("parses a full valid prefs object", () => {
    const json = JSON.stringify({
      date: "2026-05-22",
      range: "sedmica",
      status: "ceka",
      sort: "asc",
    });
    expect(parseTerminiPrefs(json)).toEqual({
      date: "2026-05-22",
      range: "sedmica",
      status: "ceka",
      sort: "asc",
    });
  });

  it("ignores fields with invalid values", () => {
    const json = JSON.stringify({
      date: "not-a-date",
      range: "ICANT",
      status: "BOGUS",
      sort: "weird",
    });
    expect(parseTerminiPrefs(json)).toEqual({});
  });

  it("ignores extra unknown fields", () => {
    const json = JSON.stringify({
      date: "2026-05-22",
      somethingElse: "ignored",
    });
    expect(parseTerminiPrefs(json)).toEqual({ date: "2026-05-22" });
  });
});

describe("serializeTerminiPrefs", () => {
  it("produces a parseable JSON string", () => {
    const prefs: TerminiPrefs = {
      date: "2026-05-22",
      status: "ceka",
    };
    const serialized = serializeTerminiPrefs(prefs);
    expect(JSON.parse(serialized)).toEqual(prefs);
  });

  it("omits undefined fields", () => {
    const prefs: TerminiPrefs = {
      range: "sedmica",
    };
    const parsed = JSON.parse(serializeTerminiPrefs(prefs));
    expect(parsed).toEqual({ range: "sedmica" });
    expect(Object.keys(parsed)).not.toContain("date");
  });

  it("roundtrips through parse", () => {
    const prefs: TerminiPrefs = {
      date: "2026-05-22",
      range: "sedmica",
      status: "ceka",
      sort: "desc",
    };
    expect(parseTerminiPrefs(serializeTerminiPrefs(prefs))).toEqual(prefs);
  });
});

describe("computeDefaultSort", () => {
  it("returns 'asc' kad je date setovan (single-day view)", () => {
    expect(computeDefaultSort({ date: "2026-05-19", range: "svi" })).toBe("asc");
  });

  it("returns 'asc' za range='danas' (single-day view)", () => {
    expect(computeDefaultSort({ date: undefined, range: "danas" })).toBe("asc");
  });

  it("returns 'desc' za range='sedmica' (multi-day)", () => {
    expect(computeDefaultSort({ date: undefined, range: "sedmica" })).toBe("desc");
  });

  it("returns 'desc' za range='mjesec' (multi-day)", () => {
    expect(computeDefaultSort({ date: undefined, range: "mjesec" })).toBe("desc");
  });

  it("returns 'desc' za range='svi' (multi-day)", () => {
    expect(computeDefaultSort({ date: undefined, range: "svi" })).toBe("desc");
  });
});

describe("resolveTerminiPrefs", () => {
  it("svi defaulti za prazan URL + prazan cookie", () => {
    const result = resolveTerminiPrefs({}, {});
    expect(result).toEqual({
      date: undefined,
      range: "svi",
      status: "svi",
      sort: "desc",
      isDefaultSort: true,
    });
  });

  it("per-param merge — URL status pobjeđuje, range/sort iz cookie-ja (NALAZ D)", () => {
    const result = resolveTerminiPrefs(
      { status: "ceka" },
      { range: "mjesec", sort: "asc" },
    );
    expect(result).toEqual({
      date: undefined,
      range: "mjesec",
      status: "ceka",
      sort: "asc",
      isDefaultSort: false,
    });
  });

  it("URL range pobjeđuje cookie date (odbacuje cookie date)", () => {
    const result = resolveTerminiPrefs(
      { range: "sedmica" },
      { date: "2026-05-19" },
    );
    expect(result.date).toBeUndefined();
    expect(result.range).toBe("sedmica");
    expect(result.sort).toBe("desc"); // default za multi-day
    expect(result.isDefaultSort).toBe(true);
  });

  it("URL date forsira range='svi', sort default ASC (single-day)", () => {
    const result = resolveTerminiPrefs({ date: "2026-05-19" }, {});
    expect(result.date).toBe("2026-05-19");
    expect(result.range).toBe("svi");
    expect(result.sort).toBe("asc");
    expect(result.isDefaultSort).toBe(true);
  });

  it("URL ima i date i range — date pobjeđuje, range='svi'", () => {
    const result = resolveTerminiPrefs(
      { date: "2026-05-19", range: "mjesec" },
      {},
    );
    expect(result.date).toBe("2026-05-19");
    expect(result.range).toBe("svi");
  });

  it("Cookie ima i date i range — date pobjeđuje (URL prazan)", () => {
    const result = resolveTerminiPrefs(
      {},
      { date: "2026-05-19", range: "mjesec" },
    );
    expect(result.date).toBe("2026-05-19");
    expect(result.range).toBe("svi");
  });

  it("URL status=ceka + cookie {date, range} — date iz cookie-a se zadržava, range='svi'", () => {
    const result = resolveTerminiPrefs(
      { status: "ceka" },
      { date: "2026-05-19", range: "mjesec" },
    );
    expect(result.date).toBe("2026-05-19");
    expect(result.range).toBe("svi");
    expect(result.status).toBe("ceka");
  });

  it("Invalid date u URL-u → ignoriše se, pada na cookie", () => {
    const result = resolveTerminiPrefs(
      { date: "garbage" },
      { date: "2026-05-19" },
    );
    expect(result.date).toBe("2026-05-19");
  });

  it("Invalid range u URL-u → ignoriše se, pada na cookie/default", () => {
    const result = resolveTerminiPrefs(
      { range: "ICANT" },
      { range: "sedmica" },
    );
    expect(result.range).toBe("sedmica");
  });

  it("Invalid status u URL-u → ignoriše se", () => {
    const result = resolveTerminiPrefs({ status: "BOGUS" }, {});
    expect(result.status).toBe("svi");
  });

  it("Invalid sort u URL-u → ignoriše se, isDefaultSort=true", () => {
    const result = resolveTerminiPrefs({ sort: "foobar" }, {});
    expect(result.sort).toBe("desc");
    expect(result.isDefaultSort).toBe(true);
  });

  it("Explicit sort u cookie-u — isDefaultSort=false", () => {
    const result = resolveTerminiPrefs({}, { sort: "asc" });
    expect(result.sort).toBe("asc");
    expect(result.isDefaultSort).toBe(false);
  });
});
