import { describe, expect, it } from "vitest";
import { WORKDAY_END, WORKDAY_START, type Booking } from "@/entities/booking";
import { moveStart } from "./moveStart";

const DATE = "2026-10-17";
const at = (h: number, m = 0) => h * 60 + m;
const bookings: Booking[] = [
  { id: "a", date: DATE, start: "10:00", end: "11:00" },
  { id: "b", date: DATE, start: "13:00", end: "13:45" },
];

describe("moveStart", () => {
  it("shortens the duration when the next booking is in the way and says so", () => {
    // 09:00–10:00, start → 09:15: 1 h no longer fits before 10:00.
    const result = moveStart({ date: DATE, current: { start: at(9), end: at(10) }, nextStart: at(9, 15), bookings });
    expect(result.range).toEqual({ start: at(9, 15), end: at(10) });
    expect(result.change).toEqual({
      kind: "shortened",
      previousEnd: at(10),
      end: at(10),
      previousDuration: 60,
      duration: 45,
      reason: "дальше время занято",
    });
  });

  it("explains a shortening caused by the end of the working day", () => {
    const result = moveStart({ date: DATE, current: { start: at(15), end: at(17) }, nextStart: at(16, 30), bookings });
    expect(result.range).toEqual({ start: at(16, 30), end: at(18) });
    expect(result.change).toMatchObject({ kind: "shortened", reason: "рабочий день заканчивается в 18:00" });
  });

  it("reports a shifted end when the duration is kept", () => {
    const result = moveStart({ date: DATE, current: { start: at(14), end: at(15) }, nextStart: at(14, 20), bookings });
    expect(result.range).toEqual({ start: at(14, 20), end: at(15, 20) });
    expect(result.change).toEqual({ kind: "shifted", previousEnd: at(15), end: at(15, 20), duration: 60 });
  });

  it("reports nothing when the end does not change", () => {
    const result = moveStart({ date: DATE, current: { start: at(14), end: at(15) }, nextStart: at(14), bookings });
    expect(result.change).toBeNull();
  });

  it("keeps the duration when even 30 minutes don't fit, leaving the error to validation", () => {
    // 12:50 → only 10 minutes before 13:00: the range stays 1 h and validation reports the conflict.
    const result = moveStart({ date: DATE, current: { start: at(14), end: at(15) }, nextStart: at(12, 50), bookings });
    expect(result.range).toEqual({ start: at(12, 50), end: at(13, 50) });
    // The end did move with the start; the form shows the conflict error instead of this note.
    expect(result.change).toMatchObject({ kind: "shifted", end: at(13, 50) });
  });

  it("never produces an end before or equal to the start, for any start and any previous range", () => {
    const previousRanges = [
      { start: at(9), end: at(9, 30) },
      { start: at(9), end: at(11) },
      { start: at(16), end: at(18) },
      { start: at(12), end: at(12) }, // broken input: end == start
      { start: at(12), end: at(11) }, // broken input: end < start
      { start: null, end: null },
    ];
    for (const current of previousRanges) {
      for (let nextStart = WORKDAY_START; nextStart <= WORKDAY_END; nextStart++) {
        const { range } = moveStart({ date: DATE, current, nextStart, bookings });
        expect(range.end, `start ${nextStart} from ${JSON.stringify(current)}`).toBeGreaterThan(range.start);
      }
    }
  });
});
