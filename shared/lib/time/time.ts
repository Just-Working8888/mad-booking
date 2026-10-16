/** Calendar date without time or timezone, `YYYY-MM-DD`. */
export type DateString = string;

/** Wall-clock time of day, `HH:mm` (24h). */
export type TimeString = string;

/** A moment expressed as a local calendar date plus minutes since midnight. */
export type LocalDateTime = {
  date: DateString;
  minutes: number;
};

export const MINUTES_IN_HOUR = 60;

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** `"09:30"` → `570`. Returns `null` for anything that is not a strict `HH:mm`. */
export function parseTime(value: string): number | null {
  const match = TIME_PATTERN.exec(value);
  if (!match) return null;
  return Number(match[1]) * MINUTES_IN_HOUR + Number(match[2]);
}

/** `570` → `"09:30"`. */
export function formatTime(minutes: number): TimeString {
  const hours = Math.floor(minutes / MINUTES_IN_HOUR);
  const rest = minutes % MINUTES_IN_HOUR;
  return `${String(hours).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

/** Strict `YYYY-MM-DD` that also exists on the calendar (rejects `2026-02-30`). */
export function isValidDateString(value: string): value is DateString {
  const match = DATE_PATTERN.exec(value);
  if (!match) return false;

  const [year, month, day] = match.slice(1).map(Number);
  // UTC is used only as a calendar calculator here, so the host timezone can't shift the day.
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/**
 * Current date and time as seen on a wall clock in `timeZone`.
 * Lets server and browser agree on "now" regardless of where each one runs.
 */
export function getLocalDateTime(timeZone: string, instant: Date = new Date()): LocalDateTime {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);

  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";

  return {
    date: `${part("year")}-${part("month")}-${part("day")}`,
    minutes: Number(part("hour")) * MINUTES_IN_HOUR + Number(part("minute")),
  };
}

/** Rounds minutes up to the nearest multiple of `step` (`roundUpTo(613, 5)` → `615`). */
export function roundUpTo(minutes: number, step: number): number {
  return Math.ceil(minutes / step) * step;
}

/** Rounds minutes down to the nearest multiple of `step`. */
export function roundDownTo(minutes: number, step: number): number {
  return Math.floor(minutes / step) * step;
}

/** `90` → `"1 ч 30 мин"`, `45` → `"45 мин"`, `120` → `"2 ч"`. */
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / MINUTES_IN_HOUR);
  const rest = minutes % MINUTES_IN_HOUR;
  if (hours === 0) return `${rest} мин`;
  return rest === 0 ? `${hours} ч` : `${hours} ч ${rest} мин`;
}

function toUtcDate(date: DateString): Date {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function fromUtcDate(date: Date): DateString {
  return date.toISOString().slice(0, 10);
}

/** Calendar arithmetic on `YYYY-MM-DD`, independent of the host timezone and DST. */
export function addDays(date: DateString, days: number): DateString {
  const result = toUtcDate(date);
  result.setUTCDate(result.getUTCDate() + days);
  return fromUtcDate(result);
}

/** The seven dates of the Monday-based week containing `date`. */
export function getWeekDates(date: DateString): DateString[] {
  const weekday = (toUtcDate(date).getUTCDay() + 6) % 7; // Monday = 0
  const monday = addDays(date, -weekday);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}
