import dayjs from "dayjs";
import { formatDuration, formatTime, type DateString } from "@/shared/lib/time";
import { toMinuteRange, type BookingStatus, type MinuteRange } from "../model";
import type { Booking } from "../model";

export const UNTITLED = "Без названия";

export const STATUS_LABEL: Record<BookingStatus, string | null> = {
  upcoming: null,
  ongoing: "Идёт сейчас",
  past: "Завершена",
};

/** `{ start: 600, end: 690 }` → `"10:00–11:30"`. */
export function formatRange({ start, end }: MinuteRange): string {
  return `${formatTime(start)}–${formatTime(end)}`;
}

export function formatBookingDuration(booking: Booking): string {
  const range = toMinuteRange(booking);
  return range ? formatDuration(range.end - range.start) : "";
}

/** `"2026-10-17"` → `"Суббота, 17 октября"`. */
export function formatDayTitle(date: DateString): string {
  const text = dayjs(date).format("dddd, D MMMM");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Text for screen readers: `"Planning, 10:00–11:00"`. */
export function describeBooking(booking: Booking): string {
  return `${booking.title ?? UNTITLED}, ${booking.start}–${booking.end}`;
}
