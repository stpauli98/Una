import { describe, it, expect } from "vitest";
import { checkFileAgainstRule, RULES } from "../../../scripts/health/lib/rules.mjs";

const rule = (id: string) => RULES.find((r) => r.id === id)!;

describe("R1 anon insert+select", () => {
  it("hvata .insert().select() u fajlu koji koristi createPublicClient", () => {
    const content = `import { createPublicClient } from "@/lib/supabase/public";
const x = await anonSb.from("t").insert({a:1}).select("id").single();`;
    const v = checkFileAgainstRule(rule("R1-anon-insert-select"), "src/app/zakazi/actions.ts", content);
    expect(v.length).toBe(1);
  });
  it("ne dira fajl bez createPublicClient", () => {
    const content = `const x = await sb.from("t").insert({a:1}).select("id");`;
    expect(checkFileAgainstRule(rule("R1-anon-insert-select"), "src/app/admin/x.ts", content)).toEqual([]);
  });
  it("hvata i multi-line insert().select() lanac", () => {
    const content = `import { createPublicClient } from "@/lib/supabase/public";
await anonSb.from("appointments").insert({
  a: 1,
}).select("id");`;
    expect(checkFileAgainstRule(rule("R1-anon-insert-select"), "src/x.ts", content).length).toBe(1);
  });
  it("ne hvata .insert().select() unutar // komentara", () => {
    const content = `import { createPublicClient } from "@/lib/supabase/public";
// \`.insert(...).select("id")\` pada sa 42501 zbog RLS — ne koristiti`;
    expect(checkFileAgainstRule(rule("R1-anon-insert-select"), "src/app/zakazi/actions.ts", content)).toEqual([]);
  });
});

describe("R2 date-fns token e", () => {
  it('hvata formatInTimeZone(date, TZ, "e")', () => {
    const content = `const d = Number(formatInTimeZone(start, TZ, "e")) % 7;`;
    expect(checkFileAgainstRule(rule("R2-dayofweek-token-e"), "src/lib/booking/v.ts", content).length).toBe(1);
  });
  it('ne hvata "EEEE" format', () => {
    const content = `formatInTimeZone(d, TZ, "EEEE yyyy-MM-dd");`;
    expect(checkFileAgainstRule(rule("R2-dayofweek-token-e"), "src/x.ts", content)).toEqual([]);
  });
});

describe("R3 goli getDay", () => {
  it("hvata .getDay() bez toZonedTime u booking modulu", () => {
    const content = `const w = date.getDay();`;
    expect(checkFileAgainstRule(rule("R3-bare-getday"), "src/lib/booking/x.ts", content).length).toBe(1);
  });
  it("dozvoljava toZonedTime(date, TZ).getDay()", () => {
    const content = `const w = toZonedTime(date, TZ).getDay();`;
    expect(checkFileAgainstRule(rule("R3-bare-getday"), "src/lib/booking/x.ts", content)).toEqual([]);
  });
  it("ignoriše fajlove van booking putanja", () => {
    const content = `const w = date.getDay();`;
    expect(checkFileAgainstRule(rule("R3-bare-getday"), "src/components/booking/StepCalendar.tsx", content)).toEqual([]);
  });
});

describe("R4 admin mutacija bez invalidacije", () => {
  it("hvata actions.ts sa .update( bez updateTag/revalidatePath", () => {
    const content = `export async function f() { await sb.from("services").update({a:1}).eq("id",1); }`;
    expect(checkFileAgainstRule(rule("R4-admin-mutation-no-invalidate"), "src/app/admin/(protected)/usluge/actions.ts", content).length).toBe(1);
  });
  it("prolazi kad ima updateTag", () => {
    const content = `import { updateTag } from "next/cache";
export async function f() { await sb.from("services").update({a:1}); updateTag("admin:services"); }`;
    expect(checkFileAgainstRule(rule("R4-admin-mutation-no-invalidate"), "src/app/admin/(protected)/usluge/actions.ts", content)).toEqual([]);
  });
});

describe("R5 console.error bez sanitizeError", () => {
  it("WARN za console.error sa varijablom bez sanitizeError", () => {
    const content = `console.error("failed:", err);`;
    const v = checkFileAgainstRule(rule("R5-unsanitized-console-error"), "src/app/zakazi/actions.ts", content);
    expect(v.length).toBe(1);
    expect(rule("R5-unsanitized-console-error").severity).toBe("WARN");
  });
  it("prolazi sa sanitizeError", () => {
    const content = `console.error("failed:", sanitizeError(err));`;
    expect(checkFileAgainstRule(rule("R5-unsanitized-console-error"), "src/app/zakazi/actions.ts", content)).toEqual([]);
  });
});
