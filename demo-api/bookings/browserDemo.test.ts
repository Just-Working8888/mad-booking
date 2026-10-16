import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FetchArgs } from "@reduxjs/toolkit/query";
import type { Booking } from "@/entities/booking/model";
import type { LocalDateTime } from "@/shared/lib/time";
import { createBrowserBookingsBaseQuery } from "./browserBaseQuery";
import { STORAGE_KEY, StorageWriteError, createLocalStorageBookingRepository } from "./localStorageRepository";

const NOW: LocalDateTime = { date: "2026-10-16", minutes: 12 * 60 };
const DATE = "2026-10-17";

/** Minimal in-memory `Storage`; `failWrites` imitates a full or blocked storage. */
class FakeStorage implements Storage {
  private items = new Map<string, string>();
  failWrites = false;
  get length() {
    return this.items.size;
  }
  clear() {
    this.items.clear();
  }
  getItem(key: string) {
    return this.items.get(key) ?? null;
  }
  key(index: number) {
    return [...this.items.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.items.delete(key);
  }
  setItem(key: string, value: string) {
    if (this.failWrites) throw new DOMException("Quota exceeded", "QuotaExceededError");
    this.items.set(key, value);
  }
}

describe("localStorage repository", () => {
  let storage: FakeStorage;
  let id: number;
  const repo = () =>
    createLocalStorageBookingRepository({ getStorage: () => storage, generateId: () => `id-${++id}` });

  beforeEach(() => {
    storage = new FakeStorage();
    id = 0;
  });

  it("keeps data across repository instances (a page reload)", async () => {
    const created = await repo().insert({ date: DATE, start: "10:00", end: "11:00", title: "Demo" });
    expect(await repo().listByDate(DATE)).toEqual([created]);
    expect(await repo().findById(created.id)).toEqual(created);
  });

  it("replaces and removes", async () => {
    const created = await repo().insert({ date: DATE, start: "10:00", end: "11:00" });
    await repo().replace({ ...created, end: "11:30" });
    expect((await repo().findById(created.id))?.end).toBe("11:30");
    expect(await repo().remove(created.id)).toBe(true);
    expect(await repo().remove(created.id)).toBe(false);
    expect(await repo().listByDate(DATE)).toEqual([]);
  });

  it("treats empty storage as no bookings", async () => {
    expect(await repo().listByDate(DATE)).toEqual([]);
  });

  it.each([
    ["not JSON", "{oops"],
    ["JSON null", "null"],
    ["wrong shape", JSON.stringify({ items: [] })],
    ["array instead of object", JSON.stringify([1, 2])],
  ])("survives corrupted data (%s) and reports it", async (_, raw) => {
    storage.setItem(STORAGE_KEY, raw);
    const onCorruptedData = vi.fn();
    const repository = createLocalStorageBookingRepository({ getStorage: () => storage, onCorruptedData });

    expect(await repository.listByDate(DATE)).toEqual([]);
    expect(onCorruptedData).toHaveBeenCalled();
    // The next write replaces the garbage with valid data.
    await repository.insert({ date: DATE, start: "10:00", end: "11:00" });
    expect(await repository.listByDate(DATE)).toHaveLength(1);
  });

  it("drops invalid entries but keeps valid ones", async () => {
    const valid: Booking = { id: "ok", date: DATE, start: "10:00", end: "11:00" };
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        bookings: [valid, { id: 1 }, { id: "x", date: "2026-02-30", start: "10:00", end: "11:00" }, null],
      }),
    );
    const onCorruptedData = vi.fn();
    const repository = createLocalStorageBookingRepository({ getStorage: () => storage, onCorruptedData });
    expect(await repository.listByDate(DATE)).toEqual([valid]);
    expect(await repository.findById("ok")).toEqual(valid);
    // Re-reading the same broken value doesn't spam reports.
    expect(onCorruptedData).toHaveBeenCalledOnce();
  });

  it("throws StorageWriteError when the storage refuses to write", async () => {
    storage.failWrites = true;
    await expect(repo().insert({ date: DATE, start: "10:00", end: "11:00" })).rejects.toBeInstanceOf(
      StorageWriteError,
    );
  });

  it("reads nothing and refuses writes where there is no storage (SSR, blocked storage)", async () => {
    const repository = createLocalStorageBookingRepository({ getStorage: () => null });
    expect(await repository.listByDate(DATE)).toEqual([]);
    await expect(repository.insert({ date: DATE, start: "10:00", end: "11:00" })).rejects.toBeInstanceOf(
      StorageWriteError,
    );
  });

  it("does not throw on read when the storage itself throws", async () => {
    const throwing = { getItem: () => { throw new DOMException("denied", "SecurityError"); } } as unknown as Storage;
    const repository = createLocalStorageBookingRepository({ getStorage: () => throwing });
    expect(await repository.listByDate(DATE)).toEqual([]);
  });
});

describe("browser baseQuery (demo API)", () => {
  let storage: FakeStorage;
  let call: (args: string | FetchArgs) => ReturnType<ReturnType<typeof createBrowserBookingsBaseQuery>>;

  beforeEach(() => {
    storage = new FakeStorage();
    let id = 0;
    const baseQuery = createBrowserBookingsBaseQuery({
      repository: createLocalStorageBookingRepository({ getStorage: () => storage, generateId: () => `id-${++id}` }),
      latencyMs: 0,
      now: () => NOW,
    });
    // The transport ignores the RTK `api` object; tests don't need a store.
    call = (args) => baseQuery(args, {} as never, {});
  });

  const create = (body: unknown, headers?: Record<string, string>) =>
    call({ url: "bookings", method: "POST", body, headers });

  it("serves the same CRUD contract as the Route Handlers", async () => {
    const created = await create({ date: DATE, start: "10:00", end: "11:00", title: " Demo " });
    expect(created).toEqual({ data: { id: "id-1", date: DATE, start: "10:00", end: "11:00", title: "Demo" } });

    expect(await call({ url: "bookings", params: { date: DATE } })).toEqual({ data: [created.data] });

    const updated = await call({ url: "bookings/id-1", method: "PATCH", body: { end: "11:30" } });
    expect(updated).toMatchObject({ data: { end: "11:30", title: "Demo" } });

    expect(await call({ url: "bookings/id-1", method: "DELETE" })).toEqual({ data: null });
    expect(await call({ url: "bookings", params: { date: DATE } })).toEqual({ data: [] });
  });

  it("returns 409 with the conflicting booking, 422 with the field, 404 and 400 in the API error format", async () => {
    const existing = (await create({ date: DATE, start: "10:00", end: "11:00" })).data;

    expect(await create({ date: DATE, start: "10:30", end: "11:30" })).toEqual({
      error: { status: 409, data: { error: expect.objectContaining({ code: "CONFLICT", conflict: existing }) } },
    });
    expect(await create({ date: DATE, start: "12:00", end: "12:10" })).toEqual({
      error: { status: 422, data: { error: expect.objectContaining({ code: "TOO_SHORT", field: "end" }) } },
    });
    expect(await call({ url: "bookings/missing", method: "DELETE" })).toEqual({
      error: { status: 404, data: { error: expect.objectContaining({ code: "NOT_FOUND" }) } },
    });
    expect(await call({ url: "bookings", params: { date: "2026-02-30" } })).toEqual({
      error: { status: 400, data: { error: expect.objectContaining({ code: "BAD_REQUEST" }) } },
    });
    expect(await create({ date: DATE, start: 900 })).toMatchObject({ error: { status: 400 } });
    expect(await create("not an object")).toMatchObject({ error: { status: 400 } });
  });

  it("allows adjacent bookings and rejects the past", async () => {
    await create({ date: DATE, start: "10:00", end: "11:00" });
    expect(await create({ date: DATE, start: "11:00", end: "12:00" })).toHaveProperty("data");
    expect(await create({ date: NOW.date, start: "11:00", end: "11:30" })).toMatchObject({
      error: { status: 422, data: { error: { code: "IN_PAST" } } },
    });
  });

  it("supports the one-shot conflict simulation without writing anything", async () => {
    const result = await create({ date: DATE, start: "10:00", end: "11:00" }, { "x-simulate-conflict": "1" });
    expect(result).toMatchObject({ error: { status: 409, data: { error: { code: "CONFLICT" } } } });
    expect(storage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("maps storage write failures to a 500 with a clear message, keeping data intact", async () => {
    await create({ date: DATE, start: "10:00", end: "11:00" });
    storage.failWrites = true;
    vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await create({ date: DATE, start: "12:00", end: "13:00" });
    expect(result).toMatchObject({
      error: { status: 500, data: { error: { code: "INTERNAL_ERROR", message: expect.stringContaining("хранилище") } } },
    });
    expect((await call({ url: "bookings", params: { date: DATE } })).data).toHaveLength(1);
  });

  it("answers unknown routes and methods with errors instead of throwing", async () => {
    expect(await call({ url: "rooms" })).toMatchObject({ error: { status: 404 } });
    expect(await call({ url: "bookings", method: "PUT", body: {} })).toMatchObject({ error: { status: 405 } });
  });

  it("serializes overlapping writes within one tab: exactly one wins", async () => {
    const results = await Promise.all([
      create({ date: DATE, start: "10:00", end: "11:00" }),
      create({ date: DATE, start: "10:30", end: "11:30" }),
    ]);
    expect(results.filter((r) => "data" in r)).toHaveLength(1);
    expect(results.filter((r) => "error" in r)).toHaveLength(1);
  });
});
