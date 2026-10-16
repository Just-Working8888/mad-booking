import type { BookingChanges, BookingError, BookingErrorResponse, BookingInput } from "@/entities/booking/model";
import {
  SIMULATE_CONFLICT_HEADER,
  invalidJson,
  parseBookingChangesBody,
  parseBookingInputBody,
  readWriteOptions as readWriteOptionsFromHeader,
  toErrorPayload,
} from "./protocol";
import { BookingServiceError, type WriteOptions } from "./service";

/** Adapts the transport-independent protocol (`protocol.ts`) to Route Handlers' Request/Response. */

export function errorResponse(status: number, error: BookingError): Response {
  return Response.json({ error } satisfies BookingErrorResponse, { status });
}

/** Runs a handler and maps any thrown error to a JSON error response. */
export async function handle(run: () => Promise<Response>): Promise<Response> {
  try {
    return await run();
  } catch (error) {
    if (!(error instanceof BookingServiceError)) console.error(error);
    const { status, error: body } = toErrorPayload(error);
    return errorResponse(status, body);
  }
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw invalidJson();
  }
}

export async function parseBookingInput(request: Request): Promise<BookingInput> {
  return parseBookingInputBody(await readJson(request));
}

export async function parseBookingChanges(request: Request): Promise<BookingChanges> {
  return parseBookingChangesBody(await readJson(request));
}

export function readWriteOptions(request: Request): WriteOptions {
  return readWriteOptionsFromHeader(request.headers.get(SIMULATE_CONFLICT_HEADER));
}
