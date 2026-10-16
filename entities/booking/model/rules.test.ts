import { describe, expect, it } from "vitest";
import type { LocalDateTime } from "@/shared/lib/time";
import { findConflict, isPastDate, rangesOverlap, validateBooking } from "./rules";
import type { Booking, BookingInput } from "./types";

const TODAY = "2026-10-16";
const TOMORROW = "2026-10-17";
const YESTERDAY = "2026-10-15";

/** Early morning today, so every working-hours slot today is still in the future. */
const EARLY_MORNING: LocalDateTime = { date: TODAY, minutes: 7 * 60 };

const input = (start: string, end: string, date = TOMORROW): BookingInput => ({ date, start, end });
const validate = (start: string, end: string, date = TOMORROW, now = EARLY_MORNING) =>
  validateBooking(input(start, end, date), now)?.code ?? null;

describe("validateBooking: working hours", () => {
  it("accepts a booking that starts exactly at 09:00", () => {
    expect(validate("09:00", "10:00")).toBeNull();
  });

  it("accepts a booking that ends exactly at 18:00", () => {
    expect(validate("17:00", "18:00")).toBeNull();
  });

  it("rejects a start before 09:00", () => {
    expect(validate("08:59", "10:00")).toBe("OUTSIDE_WORKING_HOURS");
  });

  it("rejects an end after 18:00", () => {
    expect(validate("17:00", "18:01")).toBe("OUTSIDE_WORKING_HOURS");
  });

  it("rejects a booking entirely outside the working day", () => {
    expect(validate("18:00", "19:00")).toBe("OUTSIDE_WORKING_HOURS");
    expect(validate("07:00", "08:00")).toBe("OUTSIDE_WORKING_HOURS");
  });
});

describe("validateBooking: start < end", () => {
  it("rejects equal start and end", () => {
    expect(validate("10:00", "10:00")).toBe("START_NOT_BEFORE_END");
  });

  it("rejects an end before the start", () => {
    expect(validate("11:00", "10:00")).toBe("START_NOT_BEFORE_END");
  });
});

describe("validateBooking: duration", () => {
  it("accepts exactly 30 minutes", () => {
    expect(validate("10:00", "10:30")).toBeNull();
  });

  it("rejects 29 minutes", () => {
    expect(validate("10:00", "10:29")).toBe("TOO_SHORT");
  });

  it("accepts exactly 2 hours", () => {
    expect(validate("10:00", "12:00")).toBeNull();
  });

  it("rejects 2 hours and 1 minute", () => {
    expect(validate("10:00", "12:01")).toBe("TOO_LONG");
  });

  it("accepts minute precision, not only 30-minute steps", () => {
    expect(validate("10:07", "11:43")).toBeNull();
  });

  it("accepts the shortest and longest bookings at the edges of the day", () => {
    expect(validate("09:00", "09:30")).toBeNull();
    expect(validate("16:00", "18:00")).toBeNull();
  });
});

describe("validateBooking: past", () => {
  const now: LocalDateTime = { date: TODAY, minutes: 12 * 60 + 15 }; // 12:15

  it("rejects any time on a past date", () => {
    expect(validate("10:00", "11:00", YESTERDAY, now)).toBe("IN_PAST");
  });

  it("rejects a start earlier than now today", () => {
    expect(validate("12:14", "13:00", TODAY, now)).toBe("IN_PAST");
  });

  it("rejects a booking that already started today, even if it has not ended", () => {
    expect(validate("12:00", "13:00", TODAY, now)).toBe("IN_PAST");
  });

  it("accepts a start equal to the current minute", () => {
    expect(validate("12:15", "13:00", TODAY, now)).toBeNull();
  });

  it("accepts a later time today and any time on a future date", () => {
    expect(validate("13:00", "14:00", TODAY, now)).toBeNull();
    expect(validate("09:00", "10:00", TOMORROW, now)).toBeNull();
  });

  it("points the error at the date for past dates and at the start for today", () => {
    expect(validateBooking(input("10:00", "11:00", YESTERDAY), now)?.field).toBe("date");
    expect(validateBooking(input("10:00", "11:00", TODAY), now)?.field).toBe("start");
  });

  it("isPastDate is true only for dates before today", () => {
    expect(isPastDate(YESTERDAY, now)).toBe(true);
    expect(isPastDate(TODAY, now)).toBe(false);
    expect(isPastDate(TOMORROW, now)).toBe(false);
  });

  it("compares dates across month and year boundaries", () => {
    const newYearsEve: LocalDateTime = { date: "2026-12-31", minutes: 17 * 60 };
    expect(validate("10:00", "11:00", "2027-01-01", newYearsEve)).toBeNull();
    expect(validate("10:00", "11:00", "2026-11-30", newYearsEve)).toBe("IN_PAST");
  });
});

describe("validateBooking: format", () => {
  it("rejects malformed and non-existent dates", () => {
    expect(validate("10:00", "11:00", "2026-02-30")).toBe("INVALID_DATE");
    expect(validate("10:00", "11:00", "17.10.2026")).toBe("INVALID_DATE");
  });

  it("rejects malformed times", () => {
    expect(validate("9:00", "10:00")).toBe("INVALID_TIME");
    expect(validate("10:00", "25:00")).toBe("INVALID_TIME");
  });

  it("rejects a title longer than 100 characters, ignoring surrounding spaces", () => {
    const now = EARLY_MORNING;
    expect(validateBooking({ ...input("10:00", "11:00"), title: "a".repeat(101) }, now)?.code).toBe(
      "TITLE_TOO_LONG",
    );
    expect(validateBooking({ ...input("10:00", "11:00"), title: ` ${"a".repeat(100)} ` }, now)).toBeNull();
  });
});

describe("rangesOverlap", () => {
  const r = (start: number, end: number) => ({ start, end });

  it("treats touching intervals as not overlapping", () => {
    expect(rangesOverlap(r(600, 660), r(660, 720))).toBe(false);
    expect(rangesOverlap(r(660, 720), r(600, 660))).toBe(false);
  });

  it("detects partial, nested and identical overlaps", () => {
    expect(rangesOverlap(r(600, 660), r(630, 690))).toBe(true);
    expect(rangesOverlap(r(600, 720), r(630, 660))).toBe(true);
    expect(rangesOverlap(r(630, 660), r(600, 720))).toBe(true);
    expect(rangesOverlap(r(600, 660), r(600, 660))).toBe(true);
  });

  it("detects a one-minute overlap", () => {
    expect(rangesOverlap(r(600, 661), r(660, 720))).toBe(true);
  });
});

describe("findConflict", () => {
  const existing: Booking[] = [
    { id: "a", date: TOMORROW, start: "10:00", end: "11:00" },
    { id: "b", date: TOMORROW, start: "13:00", end: "14:30" },
    { id: "c", date: TODAY, start: "15:00", end: "16:00" },
  ];
  const candidate = (start: string, end: string, date = TOMORROW) => ({ date, start, end });

  it("allows bookings adjacent on both sides", () => {
    expect(findConflict(candidate("09:00", "10:00"), existing)).toBeUndefined();
    expect(findConflict(candidate("11:00", "13:00"), existing)).toBeUndefined();
    expect(findConflict(candidate("14:30", "15:00"), existing)).toBeUndefined();
  });

  it("returns the overlapping booking", () => {
    expect(findConflict(candidate("10:30", "11:30"), existing)?.id).toBe("a");
    expect(findConflict(candidate("12:00", "13:01"), existing)?.id).toBe("b");
    expect(findConflict(candidate("09:30", "12:00"), existing)?.id).toBe("a");
  });

  it("ignores bookings on other dates", () => {
    expect(findConflict(candidate("15:00", "16:00"), existing)).toBeUndefined();
    expect(findConflict(candidate("10:00", "11:00", TODAY), existing)).toBeUndefined();
  });

  it("does not let an edited booking conflict with itself", () => {
    expect(findConflict(candidate("10:15", "11:15"), existing, "a")).toBeUndefined();
  });

  it("still reports conflicts with other bookings while editing", () => {
    expect(findConflict(candidate("10:30", "13:30"), existing, "a")?.id).toBe("b");
  });
});
