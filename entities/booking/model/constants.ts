import { MINUTES_IN_HOUR } from "@/shared/lib/time";

/** Working day bounds, minutes since midnight. */
export const WORKDAY_START = 9 * MINUTES_IN_HOUR;
export const WORKDAY_END = 18 * MINUTES_IN_HOUR;

export const MIN_DURATION = 30;
export const MAX_DURATION = 2 * MINUTES_IN_HOUR;

export const TITLE_MAX_LENGTH = 100;

/**
 * The room's working hours are wall-clock time at the office. "Now" is computed in this
 * timezone on both the server and the browser, so a UTC server (e.g. Vercel) and a user
 * in another timezone still agree on which slots are in the past.
 */
export const ROOM_TIME_ZONE = "Asia/Bishkek";
