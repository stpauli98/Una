import { describe, it, expect } from "vitest";
import { groupAppointmentsByDay } from "@/lib/utils/group-by-day";

type Appt = { id: number; start_time: string };

describe("groupAppointmentsByDay", () => {
  it("returns empty array when input is empty", () => {
    const result = groupAppointmentsByDay<Appt>([]);
    expect(result).toEqual([]);
  });

  it("groups single appointment under its Sarajevo date", () => {
    const appts: Appt[] = [
      { id: 1, start_time: "2026-05-19T08:00:00.000Z" }, // 10:00 Sarajevo
    ];
    const result = groupAppointmentsByDay(appts);
    expect(result).toHaveLength(1);
    expect(result[0].dateStr).toBe("2026-05-19");
    expect(result[0].appointments).toHaveLength(1);
    expect(result[0].appointments[0].id).toBe(1);
  });

  it("groups multiple appointments across two days in input order", () => {
    const appts: Appt[] = [
      { id: 1, start_time: "2026-05-19T07:00:00.000Z" }, // 09:00 Sarajevo
      { id: 2, start_time: "2026-05-19T13:00:00.000Z" }, // 15:00 Sarajevo
      { id: 3, start_time: "2026-05-20T08:00:00.000Z" }, // 10:00 Sarajevo
    ];
    const result = groupAppointmentsByDay(appts);
    expect(result).toHaveLength(2);
    expect(result[0].dateStr).toBe("2026-05-19");
    expect(result[0].appointments.map((a) => a.id)).toEqual([1, 2]);
    expect(result[1].dateStr).toBe("2026-05-20");
    expect(result[1].appointments.map((a) => a.id)).toEqual([3]);
  });

  it("respects DESC input order — groups in reverse by date", () => {
    const appts: Appt[] = [
      { id: 3, start_time: "2026-05-20T08:00:00.000Z" },
      { id: 2, start_time: "2026-05-19T13:00:00.000Z" },
      { id: 1, start_time: "2026-05-19T07:00:00.000Z" },
    ];
    const result = groupAppointmentsByDay(appts);
    expect(result.map((g) => g.dateStr)).toEqual(["2026-05-20", "2026-05-19"]);
    expect(result[1].appointments.map((a) => a.id)).toEqual([2, 1]);
  });
});
