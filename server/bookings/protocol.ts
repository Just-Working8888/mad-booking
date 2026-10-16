import type { BookingChanges, BookingError, BookingInput } from "@/entities/booking/model";
import { isValidDateString } from "@/shared/lib/time";
import { BookingServiceError, type WriteOptions } from "./service";

/**
 * The mock API contract, independent of the transport. Used by the Route Handlers (`http.ts`)
 * and by the in-browser demo transport, so both validate input and report errors identically.
 */

const BAD_REQUEST_STATUS = 400;
const INTERNAL_ERROR_STATUS = 500;

/** Header the demo UI sends to make the API answer 409 (see `WriteOptions`). */
export const SIMULATE_CONFLICT_HEADER = "x-simulate-conflict";

export type ErrorPayload = {
  status: number;
  error: BookingError;
};

function badRequest(message: string): BookingServiceError {
  return new BookingServiceError(BAD_REQUEST_STATUS, { code: "BAD_REQUEST", message });
}

/** Maps anything thrown by the service (or unexpectedly) to an HTTP status and an error body. */
export function toErrorPayload(error: unknown, internalMessage = "Что-то пошло не так. Попробуйте ещё раз"): ErrorPayload {
  if (error instanceof BookingServiceError) return { status: error.status, error: error.body };
  return { status: INTERNAL_ERROR_STATUS, error: { code: "INTERNAL_ERROR", message: internalMessage } };
}

export function parseDateParam(value: string | null | undefined): string {
  if (!value || !isValidDateString(value)) {
    throw badRequest("Параметр date обязателен в формате YYYY-MM-DD");
  }
  return value;
}

export function readWriteOptions(simulateConflictHeader: string | null | undefined): WriteOptions {
  return { simulateConflict: simulateConflictHeader === "1" };
}

function asJsonObject(body: unknown): Record<string, unknown> {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw badRequest("Тело запроса должно быть JSON-объектом");
  }
  return body as Record<string, unknown>;
}

/**
 * Checks only the shape of the payload (types of fields).
 * Formats and business rules are the service's job.
 */
export function parseBookingChangesBody(body: unknown): BookingChanges {
  const json = asJsonObject(body);
  const changes: BookingChanges = {};

  for (const field of ["date", "start", "end"] as const) {
    const value = json[field];
    if (value === undefined) continue;
    if (typeof value !== "string") throw badRequest(`Поле «${field}» должно быть строкой`);
    changes[field] = value;
  }

  const { title } = json;
  if (title !== undefined && title !== null && typeof title !== "string") {
    throw badRequest("Поле «title» должно быть строкой");
  }
  // `null` explicitly clears the title on PATCH.
  if (title !== undefined) changes.title = title ?? "";

  return changes;
}

export function parseBookingInputBody(body: unknown): BookingInput {
  const { date, start, end, title } = parseBookingChangesBody(body);
  if (date === undefined || start === undefined || end === undefined) {
    throw badRequest("Обязательные поля: date, start, end");
  }
  return { date, start, end, title };
}

export function invalidJson(): BookingServiceError {
  return badRequest("Тело запроса должно быть корректным JSON");
}
