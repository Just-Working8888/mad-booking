// Framework-free part of the entity: safe to import from both the browser and the server.
export {
  MAX_DURATION,
  MIN_DURATION,
  ROOM_TIME_ZONE,
  TITLE_MAX_LENGTH,
  WORKDAY_END,
  WORKDAY_START,
} from "./constants";
export {
  conflictError,
  findConflict,
  getRoomNow,
  isPast,
  isPastDate,
  normalizeTitle,
  rangesOverlap,
  sortByStart,
  toMinuteRange,
  validateBooking,
} from "./rules";
export type { MinuteRange } from "./rules";
export {
  CLICK_SNAP,
  DEFAULT_DURATION,
  canStartAt,
  fitEnd,
  getBookableFrom,
  getBookingStatus,
  getFreeIntervals,
  getFreeMinutes,
  getMaxEnd,
  suggestSlot,
} from "./schedule";
export type { BookingStatus, FreeInterval } from "./schedule";
export type {
  Booking,
  BookingChanges,
  BookingError,
  BookingErrorCode,
  BookingErrorResponse,
  BookingField,
  BookingInput,
  BookingRuleCode,
} from "./types";
