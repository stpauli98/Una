import { describe, it, expect } from "vitest";
import {
  parseTerminiPrefs,
  serializeTerminiPrefs,
  TERMINI_PREFS_COOKIE,
  DASHBOARD_DATE_COOKIE,
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
