import { describe, it, expect } from "vitest";
import { expandWeeklyTimeBlocks } from "@/lib/utils/recurring-blocks";

describe("expandWeeklyTimeBlocks", () => {
  it("vraća samo jedan blok ako untilDate === startDate", () => {
    const blocks = expandWeeklyTimeBlocks({
      startDateStr: "2026-06-15",
      startTimeStr: "12:00",
      endTimeStr: "13:00",
      untilDateStr: "2026-06-15",
    });
    expect(blocks).toHaveLength(1);
    expect(blocks[0].start.toISOString()).toBe("2026-06-15T10:00:00.000Z");
    expect(blocks[0].end.toISOString()).toBe("2026-06-15T11:00:00.000Z");
  });

  it("vraća 4 sedmična bloka za period od 22 dana (3 pune sedmice)", () => {
    // 2026-06-15 (pon) → 06-22, 06-29, 07-06 (sve ponedjeljci) sve do 07-06
    const blocks = expandWeeklyTimeBlocks({
      startDateStr: "2026-06-15",
      startTimeStr: "12:00",
      endTimeStr: "13:00",
      untilDateStr: "2026-07-06",
    });
    expect(blocks).toHaveLength(4);
    expect(blocks.map((b) => b.start.toISOString())).toEqual([
      "2026-06-15T10:00:00.000Z",
      "2026-06-22T10:00:00.000Z",
      "2026-06-29T10:00:00.000Z",
      "2026-07-06T10:00:00.000Z",
    ]);
  });

  it("preskoči generisanje ako untilDate < startDate", () => {
    const blocks = expandWeeklyTimeBlocks({
      startDateStr: "2026-06-15",
      startTimeStr: "12:00",
      endTimeStr: "13:00",
      untilDateStr: "2026-06-08",
    });
    expect(blocks).toHaveLength(0);
  });

  it("DST tranzicija: weekly 12:00 Sarajevo ostaje 12:00 wall-clock pre/poslije DST switch-a", () => {
    // 22. mart 2026. je nedjelja prije DST switch-a (28→29. mart switch u 2026)
    // Naredne sedmice prelaze u CEST. Wall-clock 12:00 mora ostati 12:00,
    // što znači UTC se mijenja iz 11:00 (CET) u 10:00 (CEST).
    const blocks = expandWeeklyTimeBlocks({
      startDateStr: "2026-03-22",
      startTimeStr: "12:00",
      endTimeStr: "13:00",
      untilDateStr: "2026-04-05",
    });
    expect(blocks).toHaveLength(3);
    // 22. mart — CET (+01:00): 12:00 Sarajevo = 11:00 UTC
    expect(blocks[0].start.toISOString()).toBe("2026-03-22T11:00:00.000Z");
    // 29. mart — već CEST (+02:00, switch u 2:00 toga dana): 12:00 = 10:00 UTC
    expect(blocks[1].start.toISOString()).toBe("2026-03-29T10:00:00.000Z");
    // 5. april — CEST: isto
    expect(blocks[2].start.toISOString()).toBe("2026-04-05T10:00:00.000Z");
  });

  it("end vrijeme ostaje sinhronizovano sa start za svaku okurencu", () => {
    const blocks = expandWeeklyTimeBlocks({
      startDateStr: "2026-06-15",
      startTimeStr: "09:30",
      endTimeStr: "11:30",
      untilDateStr: "2026-06-29",
    });
    expect(blocks).toHaveLength(3);
    for (const b of blocks) {
      // Trajanje uvijek 2 sata
      expect(b.end.getTime() - b.start.getTime()).toBe(2 * 60 * 60 * 1000);
    }
  });
});
