import type { BookingError, BookingErrorResponse } from "../model";

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

function isBookingErrorResponse(data: unknown): data is BookingErrorResponse {
  return (
    isObject(data) &&
    isObject(data.error) &&
    typeof data.error.code === "string" &&
    typeof data.error.message === "string"
  );
}

/**
 * Turns whatever RTK Query produced (`FetchBaseQueryError`, `SerializedError`,
 * or a value thrown by `.unwrap()`) into a `BookingError` the UI can show.
 */
export function toBookingError(error: unknown): BookingError {
  if (isObject(error) && "status" in error) {
    if (isBookingErrorResponse(error.data)) return error.data.error;
    if (error.status === "FETCH_ERROR") {
      return { code: "INTERNAL_ERROR", message: "Нет связи с сервером. Проверьте подключение и попробуйте ещё раз" };
    }
  }
  return { code: "INTERNAL_ERROR", message: "Что-то пошло не так. Попробуйте ещё раз" };
}
