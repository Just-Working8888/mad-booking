import type { BaseQueryFn, FetchArgs, FetchBaseQueryError } from "@reduxjs/toolkit/query";
import { getRoomNow, type BookingErrorResponse } from "@/entities/booking/model";
import {
  SIMULATE_CONFLICT_HEADER,
  parseBookingChangesBody,
  parseBookingInputBody,
  parseDateParam,
  readWriteOptions,
  toErrorPayload,
} from "@/server/bookings/protocol";
import type { BookingRepository } from "@/server/bookings/repository";
import { BookingServiceError, createBookingService } from "@/server/bookings/service";
import type { LocalDateTime } from "@/shared/lib/time";
import { StorageWriteError, createLocalStorageBookingRepository } from "./localStorageRepository";

type Options = {
  repository?: BookingRepository;
  /** Artificial delay, so loading and submitting states look like they do over a network. */
  latencyMs?: number;
  now?: () => LocalDateTime;
};

type Request = {
  method: string;
  path: string;
  params: Record<string, unknown> | undefined;
  body: unknown;
  headers: Headers;
};

type Result = { status: number; data: unknown };

const STORAGE_ERROR_MESSAGE =
  "Не удалось сохранить данные в браузере: хранилище недоступно или переполнено. Проверьте настройки браузера";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Data crosses a JSON boundary, exactly as it would over HTTP (drops `undefined`, no shared references). */
const throughJson = <T>(value: T): T => (value === undefined ? value : JSON.parse(JSON.stringify(value)));

function routeNotFound(): BookingServiceError {
  return new BookingServiceError(404, { code: "NOT_FOUND", message: "Неизвестный адрес API" });
}

/**
 * RTK Query transport for the public demo: instead of sending HTTP requests, it runs the same
 * booking service and protocol as the Route Handlers, against a localStorage repository.
 * Same URLs, status codes and error bodies, so the UI can't tell the difference.
 *
 * This is an emulation inside one browser, not a server: data is per browser, and there is no
 * atomicity between tabs.
 */
export function createBrowserBookingsBaseQuery({
  repository = createLocalStorageBookingRepository({
    onCorruptedData: () => console.warn("Demo storage contained invalid bookings; they were ignored."),
  }),
  latencyMs = 250,
  now = () => getRoomNow(),
}: Options = {}): BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> {
  const service = createBookingService({ repository, now });

  async function route({ method, path, params, body, headers }: Request): Promise<Result> {
    const [resource, rawId, ...rest] = path.replace(/^\/+|\/+$/g, "").split("/");
    if (resource !== "bookings" || rest.length > 0) throw routeNotFound();
    const options = readWriteOptions(headers.get(SIMULATE_CONFLICT_HEADER));

    if (rawId === undefined) {
      if (method === "GET") {
        const date = parseDateParam(typeof params?.date === "string" ? params.date : null);
        return { status: 200, data: await service.list(date) };
      }
      if (method === "POST") {
        return { status: 201, data: await service.create(parseBookingInputBody(body), options) };
      }
    } else {
      const id = decodeURIComponent(rawId);
      if (method === "PATCH") {
        return { status: 200, data: await service.update(id, parseBookingChangesBody(body), options) };
      }
      if (method === "DELETE") {
        await service.remove(id);
        return { status: 204, data: null };
      }
    }
    throw new BookingServiceError(405, { code: "BAD_REQUEST", message: `Метод ${method} не поддерживается` });
  }

  return async (args) => {
    const { url, method = "GET", params, body, headers } = typeof args === "string" ? { url: args } : args;
    if (latencyMs > 0) await delay(latencyMs);

    try {
      const { data } = await route({
        method: method.toUpperCase(),
        path: url,
        params,
        body: throughJson(body),
        headers: new Headers(headers as HeadersInit | undefined),
      });
      return { data: throughJson(data) };
    } catch (error) {
      if (!(error instanceof BookingServiceError)) console.error(error);
      const { status, error: bookingError } = toErrorPayload(
        error,
        error instanceof StorageWriteError ? STORAGE_ERROR_MESSAGE : undefined,
      );
      return { error: { status, data: { error: bookingError } satisfies BookingErrorResponse } };
    }
  };
}
