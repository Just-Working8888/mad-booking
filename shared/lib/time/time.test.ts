import { describe, expect, it } from "vitest";
import {
  addDays,
  formatDuration,
  formatTime,
  getLocalDateTime,
  getWeekDates,
  isValidDateString,
  parseTime,
  roundDownTo,
  roundUpTo,
} from "./time";

describe("parseTime", () => {
  it.each([
    ["00:00", 0],
    ["09:00", 540],
    ["09:07", 547],
    ["18:00", 1080],
    ["23:59", 1439],
  ])("parses %s as %i minutes", (value, minutes) => {
    expect(parseTime(value)).toBe(minutes);
  });

  it.each(["9:00", "24:00", "12:60", "12:5", "12-00", "", " 09:00", "09:00:00"])(
    "rejects %j",
    (value) => {
      expect(parseTime(value)).toBeNull();
    },
  );
});

describe("formatTime", () => {
  it("pads hours and minutes", () => {
    expect(formatTime(540)).toBe("09:00");
    expect(formatTime(547)).toBe("09:07");
    expect(formatTime(1080)).toBe("18:00");
  });

  it("round-trips with parseTime", () => {
    expect(formatTime(parseTime("13:45")!)).toBe("13:45");
  });
});

describe("isValidDateString", () => {
  it.each(["2026-10-16", "2024-02-29", "2026-12-31"])("accepts %s", (value) => {
    expect(isValidDateString(value)).toBe(true);
  });

  it.each(["2026-02-29", "2026-02-30", "2026-13-01", "2026-00-10", "2026-1-5", "16.10.2026", ""])(
    "rejects %j",
    (value) => {
      expect(isValidDateString(value)).toBe(false);
    },
  );
});

describe("getLocalDateTime", () => {
  it("returns the wall-clock date and time in the given timezone", () => {
    // 2026-10-16 20:30 UTC is already the 17th, 02:30 in Bishkek (UTC+6).
    const instant = new Date("2026-10-16T20:30:00Z");

    expect(getLocalDateTime("UTC", instant)).toEqual({ date: "2026-10-16", minutes: 20 * 60 + 30 });
    expect(getLocalDateTime("Asia/Bishkek", instant)).toEqual({ date: "2026-10-17", minutes: 2 * 60 + 30 });
  });

  it("reports midnight as 00:00, not 24:00", () => {
    expect(getLocalDateTime("UTC", new Date("2026-10-16T00:00:00Z"))).toEqual({
      date: "2026-10-16",
      minutes: 0,
    });
  });
});

describe("rounding", () => {
  it("rounds to a step", () => {
    expect(roundUpTo(613, 5)).toBe(615);
    expect(roundUpTo(615, 5)).toBe(615);
    expect(roundDownTo(614, 15)).toBe(600);
  });
});

describe("formatDuration", () => {
  it.each([
    [30, "30 мин"],
    [60, "1 ч"],
    [90, "1 ч 30 мин"],
    [97, "1 ч 37 мин"],
    [120, "2 ч"],
  ])("formats %i minutes as %s", (minutes, text) => {
    expect(formatDuration(minutes)).toBe(text);
  });
});

describe("addDays", () => {
  it("crosses month, year and leap-day boundaries", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2024-03-01", -1)).toBe("2024-02-29");
    expect(addDays("2026-10-16", 0)).toBe("2026-10-16");
  });
});

describe("getWeekDates", () => {
  it("returns Monday..Sunday of the week", () => {
    // 2026-10-16 is a Friday.
    expect(getWeekDates("2026-10-16")).toEqual([
      "2026-10-12",
      "2026-10-13",
      "2026-10-14",
      "2026-10-15",
      "2026-10-16",
      "2026-10-17",
      "2026-10-18",
    ]);
    // Sunday belongs to the week that started the previous Monday.
    expect(getWeekDates("2026-10-18")[0]).toBe("2026-10-12");
  });
});
