import {
  formatTime,
  getLocalDateTime,
  isValidDateString,
  parseTime,
  type DateString,
  type LocalDateTime,
} from "@/shared/lib/time";
import {
  MAX_DURATION,
  MIN_DURATION,
  ROOM_TIME_ZONE,
  TITLE_MAX_LENGTH,
  WORKDAY_END,
  WORKDAY_START,
} from "./constants";
import type { Booking, BookingError, BookingInput } from "./types";

/** Half-open interval `[start, end)` in minutes since midnight. */
export type MinuteRange = {
  start: number;
  end: number;
};

/**
 * Half-open intervals overlap only if each starts before the other ends,
 * so 10:00–11:00 and 11:00–12:00 merely touch and do not conflict.
 */
export function rangesOverlap(a: MinuteRange, b: MinuteRange): boolean {
  return a.start < b.end && b.start < a.end;
}

/** `{ start: "09:00", end: "10:30" }` → `{ start: 540, end: 630 }`, or `null` if malformed. */
export function toMinuteRange(booking: Pick<Booking, "start" | "end">): MinuteRange | null {
  const start = parseTime(booking.start);
  const end = parseTime(booking.end);
  return start === null || end === null ? null : { start, end };
}

/** Trims the title and turns an empty one into `undefined`. */
export function normalizeTitle(title: string | undefined): string | undefined {
  const trimmed = title?.trim();
  return trimmed ? trimmed : undefined;
}

/**
 * Checks the rules a single booking must satisfy by itself.
 * Returns the first violated rule, or `null` if the booking is valid.
 * Overlaps with other bookings are checked separately by `findConflict`.
 */
export function validateBooking(input: BookingInput, now: LocalDateTime): BookingError | null {
  if (!isValidDateString(input.date)) {
    return { code: "INVALID_DATE", field: "date", message: "Некорректная дата" };
  }

  const start = parseTime(input.start);
  if (start === null) {
    return { code: "INVALID_TIME", field: "start", message: "Некорректное время начала" };
  }
  const end = parseTime(input.end);
  if (end === null) {
    return { code: "INVALID_TIME", field: "end", message: "Некорректное время окончания" };
  }

  const workday = `${formatTime(WORKDAY_START)}–${formatTime(WORKDAY_END)}`;
  if (start < WORKDAY_START || start > WORKDAY_END) {
    return {
      code: "OUTSIDE_WORKING_HOURS",
      field: "start",
      message: `Начало должно быть в пределах рабочего дня (${workday})`,
    };
  }
  if (end < WORKDAY_START || end > WORKDAY_END) {
    return {
      code: "OUTSIDE_WORKING_HOURS",
      field: "end",
      message: `Окончание должно быть в пределах рабочего дня (${workday})`,
    };
  }

  if (start >= end) {
    return {
      code: "START_NOT_BEFORE_END",
      field: "end",
      message: "Время окончания должно быть позже времени начала",
    };
  }

  const duration = end - start;
  if (duration < MIN_DURATION) {
    return {
      code: "TOO_SHORT",
      field: "end",
      message: `Минимальная длительность брони — ${MIN_DURATION} минут`,
    };
  }
  if (duration > MAX_DURATION) {
    return {
      code: "TOO_LONG",
      field: "end",
      message: `Максимальная длительность брони — ${MAX_DURATION / 60} часа`,
    };
  }

  if (isPast(input.date, start, now)) {
    return {
      code: "IN_PAST",
      field: input.date < now.date ? "date" : "start",
      message: "Нельзя бронировать прошедшее время",
    };
  }

  const title = normalizeTitle(input.title);
  if (title && title.length > TITLE_MAX_LENGTH) {
    return {
      code: "TITLE_TOO_LONG",
      field: "title",
      message: `Название не должно быть длиннее ${TITLE_MAX_LENGTH} символов`,
    };
  }

  return null;
}

/** "Now" on the office wall clock. The only impure helper here; rules take `now` as an argument. */
export function getRoomNow(instant: Date = new Date()): LocalDateTime {
  return getLocalDateTime(ROOM_TIME_ZONE, instant);
}

/**
 * Whether a moment (`date` at `minutes`) is already behind `now`.
 * `YYYY-MM-DD` strings compare lexicographically in calendar order.
 */
export function isPast(date: DateString, minutes: number, now: LocalDateTime): boolean {
  if (date !== now.date) return date < now.date;
  return minutes < now.minutes;
}

/** No bookings can be created for a date that is already over. */
export function isPastDate(date: DateString, now: LocalDateTime): boolean {
  return date < now.date;
}

/**
 * Finds an existing booking on the same date that overlaps the candidate.
 * `excludeId` is the booking being edited, so it never conflicts with itself.
 */
export function findConflict(
  candidate: Pick<Booking, "date" | "start" | "end">,
  existing: readonly Booking[],
  excludeId?: string,
): Booking | undefined {
  const range = toMinuteRange(candidate);
  if (!range) return undefined;

  return existing.find((booking) => {
    if (booking.id === excludeId || booking.date !== candidate.date) return false;
    const other = toMinuteRange(booking);
    return other !== null && rangesOverlap(range, other);
  });
}

export function conflictError(conflict: Booking): BookingError {
  return {
    code: "CONFLICT",
    message: `Время пересекается с бронью ${conflict.start}–${conflict.end}`,
    conflict,
  };
}

export function sortByStart(bookings: readonly Booking[]): Booking[] {
  return [...bookings].sort((a, b) => a.start.localeCompare(b.start));
}
