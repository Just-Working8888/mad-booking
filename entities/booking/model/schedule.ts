import { roundDownTo, roundUpTo, type DateString, type LocalDateTime } from "@/shared/lib/time";
import { MAX_DURATION, MIN_DURATION, WORKDAY_END, WORKDAY_START } from "./constants";
import { isPast, toMinuteRange, type MinuteRange } from "./rules";
import type { Booking } from "./types";

/** Length of a booking suggested when the user clicks on free time. */
export const DEFAULT_DURATION = 60;
/** A click on the timeline snaps the start to this grid. */
export const CLICK_SNAP = 15;
/** "Now" is rounded up to this grid, so suggestions don't start at 12:13. */
const NOW_SNAP = 5;

/** `upcoming` can be edited; `ongoing` and `past` can only be deleted. */
export type BookingStatus = "upcoming" | "ongoing" | "past";

export type FreeInterval = MinuteRange & {
  /** At least `MIN_DURATION` long, so a booking fits. */
  bookable: boolean;
};

export function getBookingStatus(booking: Booking, now: LocalDateTime): BookingStatus {
  const range = toMinuteRange(booking);
  if (!range || !isPast(booking.date, range.start, now)) return "upcoming";
  return booking.date === now.date && range.end > now.minutes ? "ongoing" : "past";
}

/** Earliest minute of `date` a booking may start at; `WORKDAY_END` means the day is over. */
export function getBookableFrom(date: DateString, now: LocalDateTime): number {
  if (date < now.date) return WORKDAY_END;
  if (date > now.date) return WORKDAY_START;
  return Math.min(Math.max(now.minutes, WORKDAY_START), WORKDAY_END);
}

function busyRanges(date: DateString, bookings: readonly Booking[], excludeId?: string): MinuteRange[] {
  return bookings
    .filter((booking) => booking.date === date && booking.id !== excludeId)
    .map(toMinuteRange)
    .filter((range): range is MinuteRange => range !== null)
    .sort((a, b) => a.start - b.start);
}

/** Free gaps of the working day that are not in the past, in chronological order. */
export function getFreeIntervals(
  date: DateString,
  bookings: readonly Booking[],
  now: LocalDateTime,
  excludeId?: string,
): FreeInterval[] {
  const intervals: FreeInterval[] = [];
  const push = (start: number, end: number) =>
    intervals.push({ start, end, bookable: end - start >= MIN_DURATION });

  let cursor = getBookableFrom(date, now);
  for (const range of busyRanges(date, bookings, excludeId)) {
    if (range.start > cursor) push(cursor, range.start);
    cursor = Math.max(cursor, range.end);
  }
  if (cursor < WORKDAY_END) push(cursor, WORKDAY_END);

  return intervals;
}

/** Total bookable minutes left on `date`. */
export function getFreeMinutes(date: DateString, bookings: readonly Booking[], now: LocalDateTime): number {
  return getFreeIntervals(date, bookings, now)
    .filter((interval) => interval.bookable)
    .reduce((sum, interval) => sum + interval.end - interval.start, 0);
}

/**
 * Latest allowed end for a booking starting at `start`: the closest of start + 2h, 18:00 and the
 * next booking. Returns `start` itself when `start` falls inside another booking.
 */
export function getMaxEnd(
  date: DateString,
  start: number,
  bookings: readonly Booking[],
  excludeId?: string,
): number {
  let limit = Math.min(start + MAX_DURATION, WORKDAY_END);
  for (const range of busyRanges(date, bookings, excludeId)) {
    if (range.start <= start && start < range.end) return start;
    if (range.start > start) limit = Math.min(limit, range.start);
  }
  return limit;
}

/** Whether a booking of at least `MIN_DURATION` can start at `start`. */
export function canStartAt(
  date: DateString,
  start: number,
  bookings: readonly Booking[],
  now: LocalDateTime,
  excludeId?: string,
): boolean {
  if (start < getBookableFrom(date, now)) return false;
  return getMaxEnd(date, start, bookings, excludeId) - start >= MIN_DURATION;
}

/**
 * New end after the start moved: keeps the previous duration when it fits,
 * otherwise shrinks it to the latest allowed end. If even `MIN_DURATION` doesn't fit,
 * keeps the duration and lets validation explain the problem.
 */
export function fitEnd(
  date: DateString,
  start: number,
  duration: number,
  bookings: readonly Booking[],
  excludeId?: string,
): number {
  const maxEnd = getMaxEnd(date, start, bookings, excludeId);
  const end = Math.min(start + duration, maxEnd);
  return end - start >= MIN_DURATION ? end : start + duration;
}

/**
 * A ready-to-use slot for the create form.
 * With `at` (a clicked minute) — inside the free gap under the cursor; without — the first free gap.
 * Returns `null` when there's nothing to book.
 */
export function suggestSlot(
  date: DateString,
  bookings: readonly Booking[],
  now: LocalDateTime,
  at?: number,
): MinuteRange | null {
  const intervals = getFreeIntervals(date, bookings, now).filter((interval) => interval.bookable);
  const interval =
    at === undefined
      ? intervals[0]
      : intervals.find((candidate) => at >= candidate.start && at < candidate.end);
  if (!interval) return null;

  const latestStart = interval.end - MIN_DURATION;
  let start = Math.max(at === undefined ? interval.start : roundDownTo(at, CLICK_SNAP), interval.start);
  // The gap may begin at an odd minute ("now" = 12:13); prefer a rounder start if it still fits.
  if (roundUpTo(start, NOW_SNAP) <= latestStart) start = roundUpTo(start, NOW_SNAP);
  start = Math.min(start, latestStart);

  return { start, end: Math.min(start + DEFAULT_DURATION, interval.end) };
}
