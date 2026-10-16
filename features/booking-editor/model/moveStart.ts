import { DEFAULT_DURATION, WORKDAY_END, fitEnd, type Booking, type MinuteRange } from "@/entities/booking";
import type { DateString } from "@/shared/lib/time";

/** How the end reacted to a new start. Every automatic change is reported, never applied silently. */
export type EndChange =
  | { kind: "shifted"; previousEnd: number; end: number; duration: number }
  | { kind: "shortened"; previousEnd: number; end: number; previousDuration: number; duration: number; reason: string };

type MoveStartParams = {
  date: DateString;
  /** Current values of the form; `end` may be missing or not after `start`. */
  current: { start: number | null; end: number | null };
  nextStart: number;
  bookings: readonly Booking[];
  excludeId?: string;
};

/**
 * New time range after the user picked another start: the duration is kept when it fits,
 * otherwise shortened up to the next booking / 18:00. The result always ends after it starts.
 */
export function moveStart({ date, current, nextStart, bookings, excludeId }: MoveStartParams): {
  range: MinuteRange;
  change: EndChange | null;
} {
  const { start, end } = current;
  const hasRange = start !== null && end !== null && end > start;
  const duration = hasRange ? end - start : DEFAULT_DURATION;
  const nextEnd = fitEnd(date, nextStart, duration, bookings, excludeId);
  const range = { start: nextStart, end: nextEnd };

  if (!hasRange || end === null) return { range, change: null };

  if (nextEnd - nextStart < duration) {
    return {
      range,
      change: {
        kind: "shortened",
        previousEnd: end,
        end: nextEnd,
        previousDuration: duration,
        duration: nextEnd - nextStart,
        reason: nextStart + duration > WORKDAY_END ? "рабочий день заканчивается в 18:00" : "дальше время занято",
      },
    };
  }
  if (nextEnd !== end) {
    return { range, change: { kind: "shifted", previousEnd: end, end: nextEnd, duration } };
  }
  return { range, change: null };
}
