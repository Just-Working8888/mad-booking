import { beforeEach, describe, expect, it } from "vitest";
import type { LocalDateTime } from "@/shared/lib/time";
import { createInMemoryBookingRepository } from "./repository";
import { BookingServiceError, createBookingService, type BookingService } from "./service";

const NOW: LocalDateTime = { date: "2026-10-16", minutes: 12 * 60 };
const DATE = "2026-10-17";

async function expectServiceError(promise: Promise<unknown>, status: number, code: string) {
  const error = await promise.then(
    () => undefined,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(BookingServiceError);
  expect((error as BookingServiceError).status).toBe(status);
  expect((error as BookingServiceError).body.code).toBe(code);
}

describe("booking service", () => {
  let service: BookingService;

  beforeEach(() => {
    let id = 0;
    const repository = createInMemoryBookingRepository(() => `id-${++id}`);
    service = createBookingService({ repository, now: () => NOW });
  });

  it("creates, lists sorted by start, updates and deletes", async () => {
    const late = await service.create({ date: DATE, start: "14:00", end: "15:00", title: " Sync " });
    const early = await service.create({ date: DATE, start: "10:00", end: "11:00" });

    expect(late.title).toBe("Sync");
    expect((await service.list(DATE)).map((b) => b.id)).toEqual([early.id, late.id]);

    const moved = await service.update(late.id, { start: "15:00", end: "16:00" });
    expect(moved).toMatchObject({ id: late.id, start: "15:00", end: "16:00", title: "Sync" });

    await service.remove(early.id);
    expect(await service.list(DATE)).toEqual([moved]);
  });

  it("rejects rule violations with 422", async () => {
    await expectServiceError(
      service.create({ date: DATE, start: "10:00", end: "10:20" }),
      422,
      "TOO_SHORT",
    );
    await expectServiceError(
      service.create({ date: NOW.date, start: "11:00", end: "12:30" }),
      422,
      "IN_PAST",
    );
  });

  it("returns 409 with the conflicting booking on overlap, but allows adjacent slots", async () => {
    const existing = await service.create({ date: DATE, start: "10:00", end: "11:00" });

    await expect(service.create({ date: DATE, start: "11:00", end: "12:00" })).resolves.toBeDefined();

    const error = await service.create({ date: DATE, start: "10:30", end: "11:30" }).catch((e) => e);
    expect(error).toBeInstanceOf(BookingServiceError);
    expect(error.status).toBe(409);
    expect(error.body.conflict).toEqual(existing);
  });

  it("lets an edited booking overlap its own previous time", async () => {
    const booking = await service.create({ date: DATE, start: "10:00", end: "11:00" });
    await expect(service.update(booking.id, { end: "11:30" })).resolves.toMatchObject({ end: "11:30" });
  });

  it("rejects an edit that overlaps another booking", async () => {
    await service.create({ date: DATE, start: "10:00", end: "11:00" });
    const other = await service.create({ date: DATE, start: "12:00", end: "13:00" });
    await expectServiceError(service.update(other.id, { start: "10:30", end: "12:00" }), 409, "CONFLICT");
  });

  it("validates the merged result of a partial update", async () => {
    const booking = await service.create({ date: DATE, start: "10:00", end: "11:00" });
    await expectServiceError(service.update(booking.id, { end: "12:30" }), 422, "TOO_LONG");
  });

  it("checks conflicts on the new date when a booking is moved to another day", async () => {
    await service.create({ date: "2026-10-18", start: "10:00", end: "11:00" });
    const booking = await service.create({ date: DATE, start: "10:00", end: "11:00" });
    await expectServiceError(service.update(booking.id, { date: "2026-10-18" }), 409, "CONFLICT");
  });

  it("clears the title when an empty string is sent", async () => {
    const booking = await service.create({ date: DATE, start: "10:00", end: "11:00", title: "Demo" });
    const updated = await service.update(booking.id, { title: "" });
    expect(updated.title).toBeUndefined();
  });

  it("returns 404 for unknown ids", async () => {
    await expectServiceError(service.update("missing", { start: "10:00" }), 404, "NOT_FOUND");
    await expectServiceError(service.remove("missing"), 404, "NOT_FOUND");
  });

  it("lets exactly one of two concurrent overlapping requests win", async () => {
    const results = await Promise.allSettled([
      service.create({ date: DATE, start: "10:00", end: "11:00" }),
      service.create({ date: DATE, start: "10:30", end: "11:30" }),
    ]);

    expect(results.map((r) => r.status).sort()).toEqual(["fulfilled", "rejected"]);
    const rejected = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(rejected.reason.status).toBe(409);
    expect(await service.list(DATE)).toHaveLength(1);
  });

  it("simulateConflict answers 409 without writing anything", async () => {
    const error = await service
      .create({ date: DATE, start: "10:00", end: "11:00" }, { simulateConflict: true })
      .catch((e) => e);

    expect(error.status).toBe(409);
    expect(error.body.code).toBe("CONFLICT");
    expect(await service.list(DATE)).toEqual([]);
  });

  it("simulateConflict on edit leaves the booking unchanged", async () => {
    const booking = await service.create({ date: DATE, start: "10:00", end: "11:00", title: "Demo" });
    await expectServiceError(
      service.update(booking.id, { title: "Renamed" }, { simulateConflict: true }),
      409,
      "CONFLICT",
    );
    expect(await service.list(DATE)).toEqual([booking]);
  });

  it("a real conflict wins over the simulated one", async () => {
    const existing = await service.create({ date: DATE, start: "10:00", end: "11:00" });
    const error = await service
      .create({ date: DATE, start: "10:30", end: "11:30" }, { simulateConflict: true })
      .catch((e) => e);
    expect(error.body.conflict).toEqual(existing);
  });

  it("simulateConflict does not hide a 404", async () => {
    await expectServiceError(service.update("missing", { title: "x" }, { simulateConflict: true }), 404, "NOT_FOUND");
  });

  it("simulateConflict does not hide rule violations", async () => {
    await expectServiceError(
      service.create({ date: DATE, start: "10:00", end: "10:10" }, { simulateConflict: true }),
      422,
      "TOO_SHORT",
    );
  });
});
