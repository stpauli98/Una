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
