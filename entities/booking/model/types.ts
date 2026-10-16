import type { DateString, TimeString } from "@/shared/lib/time";

export type Booking = {
  id: string;
  date: DateString;
  start: TimeString;
  end: TimeString;
  title?: string;
};

/** Payload for creating a booking (POST). */
export type BookingInput = Omit<Booking, "id">;

/** Partial payload for editing a booking (PATCH). */
export type BookingChanges = Partial<BookingInput>;

/** Business rules a booking can break by itself, without looking at other bookings. */
export type BookingRuleCode =
  | "INVALID_DATE"
  | "INVALID_TIME"
  | "OUTSIDE_WORKING_HOURS"
  | "START_NOT_BEFORE_END"
  | "TOO_SHORT"
  | "TOO_LONG"
  | "IN_PAST"
  | "TITLE_TOO_LONG";

export type BookingErrorCode =
  | BookingRuleCode
  | "CONFLICT"
  | "NOT_FOUND"
  | "BAD_REQUEST"
  | "INTERNAL_ERROR";

export type BookingField = keyof BookingInput;

/** Error shape shared by the validator and the API (`{ error: BookingError }`). */
export type BookingError = {
  code: BookingErrorCode;
  message: string;
  /** Form field the error belongs to, when there is one. */
  field?: BookingField;
  /** For `CONFLICT`: the existing booking that occupies the slot. */
  conflict?: Booking;
};

export type BookingErrorResponse = {
  error: BookingError;
};
