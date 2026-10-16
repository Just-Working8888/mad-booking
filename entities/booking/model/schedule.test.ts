import { describe, expect, it } from "vitest";
import type { LocalDateTime } from "@/shared/lib/time";
import {
  canStartAt,
  fitEnd,
  getBookableFrom,
  getBookingStatus,
  getFreeIntervals,
  getFreeMinutes,
  getMaxEnd,
  suggestSlot,
} from "./schedule";
import type { Booking } from "./types";

const TODAY = "2026-10-16";
const TOMORROW = "2026-10-17";
const YESTERDAY = "2026-10-15";

const at = (hours: number, minutes = 0) => hours * 60 + minutes;
const nowAt = (hours: number, minutes = 0): LocalDateTime => ({ date: TODAY, minutes: at(hours, minutes) });
const EARLY = nowAt(7);

const booking = (id: string, start: string, end: string, date = TOMORROW): Booking => ({
  id,
  date,
  start,
  end,
});

// 10:00–11:00, 11:00–11:45 (adjacent), 12:00–13:30, then free till 18:00
const day: Booking[] = [
  booking("a", "10:00", "11:00"),
  booking("b", "11:00", "11:45"),
  booking("c", "12:00", "13:30"),
  booking("other-day", "09:00", "18:00", TODAY),
];

describe("getBookingStatus", () => {
  const b = booking("x", "12:00", "13:00", TODAY);

  it("is upcoming until the start minute (inclusive)", () => {
    expect(getBookingStatus(b, nowAt(11, 59))).toBe("upcoming");
    expect(getBookingStatus(b, nowAt(12, 0))).toBe("upcoming");
  });

  it("is ongoing after the start and before the end", () => {
    expect(getBookingStatus(b, nowAt(12, 1))).toBe("ongoing");
    expect(getBookingStatus(b, nowAt(12, 59))).toBe("ongoing");
  });

  it("is past from the end minute and on earlier dates", () => {
    expect(getBookingStatus(b, nowAt(13, 0))).toBe("past");
    expect(getBookingStatus(booking("y", "12:00", "13:00", YESTERDAY), EARLY)).toBe("past");
  });

  it("is upcoming on future dates", () => {
    expect(getBookingStatus(booking("z", "09:00", "10:00"), nowAt(17))).toBe("upcoming");
  });
});

describe("getBookableFrom", () => {
  it("starts at 09:00 on future dates and before the working day today", () => {
    expect(getBookableFrom(TOMORROW, nowAt(17))).toBe(at(9));
    expect(getBookableFrom(TODAY, EARLY)).toBe(at(9));
  });

  it("starts at the current minute during the day", () => {
    expect(getBookableFrom(TODAY, nowAt(12, 13))).toBe(at(12, 13));
  });

  it("is the end of the day for past dates and after 18:00 today", () => {
    expect(getBookableFrom(YESTERDAY, EARLY)).toBe(at(18));
    expect(getBookableFrom(TODAY, nowAt(19))).toBe(at(18));
  });
});

describe("getFreeIntervals", () => {
  it("returns gaps between bookings, ignoring other dates", () => {
    expect(getFreeIntervals(TOMORROW, day, EARLY)).toEqual([
      { start: at(9), end: at(10), bookable: true },
      { start: at(11, 45), end: at(12), bookable: false },
      { start: at(13, 30), end: at(18), bookable: true },
    ]);
  });

  it("returns the whole working day when there are no bookings", () => {
    expect(getFreeIntervals(TOMORROW, [], EARLY)).toEqual([{ start: at(9), end: at(18), bookable: true }]);
  });

  it("cuts off the past today", () => {
    const bookings = [booking("a", "10:00", "11:00", TODAY)];
    expect(getFreeIntervals(TODAY, bookings, nowAt(10, 30))).toEqual([
      { start: at(11), end: at(18), bookable: true },
    ]);
    expect(getFreeIntervals(TODAY, bookings, nowAt(17, 40))).toEqual([
      { start: at(17, 40), end: at(18), bookable: false },
    ]);
  });

  it("is empty for past dates and fully booked days", () => {
    expect(getFreeIntervals(YESTERDAY, [], EARLY)).toEqual([]);
    expect(getFreeIntervals(TODAY, day, EARLY)).toEqual([]);
  });

  it("can ignore the booking being edited", () => {
    expect(getFreeIntervals(TOMORROW, day, EARLY, "c")).toContainEqual({
      start: at(11, 45),
      end: at(18),
      bookable: true,
    });
  });

  it("sums only bookable minutes", () => {
    // 09:00–10:00 (60) + 13:30–18:00 (270); 11:45–12:00 is too short
    expect(getFreeMinutes(TOMORROW, day, EARLY)).toBe(330);
  });
});

describe("getMaxEnd", () => {
  it("is limited by 2 hours", () => {
    expect(getMaxEnd(TOMORROW, at(14), day)).toBe(at(16));
  });

  it("is limited by the next booking", () => {
    expect(getMaxEnd(TOMORROW, at(9, 15), day)).toBe(at(10));
  });

  it("is limited by 18:00", () => {
    expect(getMaxEnd(TOMORROW, at(17), day)).toBe(at(18));
  });

  it("allows ending exactly where the next booking starts", () => {
    expect(getMaxEnd(TOMORROW, at(9), day)).toBe(at(10));
  });

  it("returns start when it falls inside a booking, but not at its end", () => {
    expect(getMaxEnd(TOMORROW, at(10, 30), day)).toBe(at(10, 30));
    expect(getMaxEnd(TOMORROW, at(10), day)).toBe(at(10));
    expect(getMaxEnd(TOMORROW, at(13, 30), day)).toBe(at(15, 30));
  });

  it("ignores the booking being edited", () => {
    expect(getMaxEnd(TOMORROW, at(12), day, "c")).toBe(at(14));
  });
});

describe("canStartAt", () => {
  it("needs at least 30 free minutes after the start", () => {
    expect(canStartAt(TOMORROW, at(9, 30), day, EARLY)).toBe(true);
    expect(canStartAt(TOMORROW, at(9, 31), day, EARLY)).toBe(false);
    expect(canStartAt(TOMORROW, at(11, 45), day, EARLY)).toBe(false);
    expect(canStartAt(TOMORROW, at(17, 30), day, EARLY)).toBe(true);
    expect(canStartAt(TOMORROW, at(17, 31), day, EARLY)).toBe(false);
  });

  it("rejects times inside bookings and in the past", () => {
    expect(canStartAt(TOMORROW, at(10, 15), day, EARLY)).toBe(false);
    expect(canStartAt(TODAY, at(12), [], nowAt(12, 1))).toBe(false);
    expect(canStartAt(TODAY, at(12, 1), [], nowAt(12, 1))).toBe(true);
  });
});

describe("fitEnd", () => {
  it("keeps the duration when it fits", () => {
    expect(fitEnd(TOMORROW, at(14), 90, day)).toBe(at(15, 30));
  });

  it("shrinks the duration up to the next booking", () => {
    expect(fitEnd(TOMORROW, at(9, 15), 60, day)).toBe(at(10));
  });

  it("keeps the duration when even 30 minutes don't fit, so validation can explain", () => {
    expect(fitEnd(TOMORROW, at(9, 45), 60, day)).toBe(at(10, 45));
  });
});

describe("suggestSlot", () => {
  it("suggests the first free hour by default", () => {
    expect(suggestSlot(TOMORROW, day, EARLY)).toEqual({ start: at(9), end: at(10) });
  });

  it("snaps a click down to 15 minutes", () => {
    expect(suggestSlot(TOMORROW, day, EARLY, at(14, 22))).toEqual({ start: at(14, 15), end: at(15, 15) });
  });

  it("fits the suggestion into a short gap", () => {
    // 09:00–10:00 gap, click at 09:50 → the latest possible 30-minute start
    expect(suggestSlot(TOMORROW, day, EARLY, at(9, 50))).toEqual({ start: at(9, 30), end: at(10) });
  });

  it("starts no earlier than now, rounded up to 5 minutes", () => {
    expect(suggestSlot(TODAY, [], nowAt(12, 13))).toEqual({ start: at(12, 15), end: at(13, 15) });
    expect(suggestSlot(TODAY, [], nowAt(12, 13), at(12, 14))).toEqual({ start: at(12, 15), end: at(13, 15) });
  });

  it("returns null for clicks outside bookable gaps and for days without free time", () => {
    expect(suggestSlot(TOMORROW, day, EARLY, at(10, 30))).toBeNull();
    expect(suggestSlot(TOMORROW, day, EARLY, at(11, 50))).toBeNull();
    expect(suggestSlot(YESTERDAY, [], EARLY)).toBeNull();
  });
});
