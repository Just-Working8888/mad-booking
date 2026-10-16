import {
  conflictError,
  findConflict,
  normalizeTitle,
  sortByStart,
  validateBooking,
  type Booking,
  type BookingChanges,
  type BookingError,
  type BookingInput,
} from "@/entities/booking/model";
import type { LocalDateTime } from "@/shared/lib/time";
import type { BookingRepository } from "./repository";

/** A business failure the HTTP layer turns into a status code and an error body. */
export class BookingServiceError extends Error {
  constructor(
    readonly status: number,
    readonly body: BookingError,
  ) {
    super(body.message);
  }
}

const VALIDATION_STATUS = 422;
const NOT_FOUND_STATUS = 404;
const CONFLICT_STATUS = 409;

/**
 * Demo only: answer 409 as if another user had taken the slot a moment earlier, so the UI's
 * conflict handling can be seen on demand. Nothing is written to storage, and every other rule
 * (validation, 404, a real conflict) is checked first and wins.
 */
export type WriteOptions = {
  simulateConflict?: boolean;
};

type Dependencies = {
  repository: BookingRepository;
  now: () => LocalDateTime;
};

export function createBookingService({ repository, now }: Dependencies) {
  function assertValid(input: BookingInput): void {
    const error = validateBooking(input, now());
    if (error) throw new BookingServiceError(VALIDATION_STATUS, error);
  }

  function simulatedConflict(): BookingServiceError {
    return new BookingServiceError(CONFLICT_STATUS, {
      code: "CONFLICT",
      message: "Это время только что занял другой пользователь (имитация конфликта)",
    });
  }

  async function assertNoConflict(input: BookingInput, excludeId?: string): Promise<void> {
    const sameDay = await repository.listByDate(input.date);
    const conflict = findConflict(input, sameDay, excludeId);
    if (conflict) throw new BookingServiceError(CONFLICT_STATUS, conflictError(conflict));
  }

  function notFound(): BookingServiceError {
    return new BookingServiceError(NOT_FOUND_STATUS, {
      code: "NOT_FOUND",
      message: "Бронь не найдена — возможно, её уже удалили",
    });
  }

  return {
    async list(date: string): Promise<Booking[]> {
      return sortByStart(await repository.listByDate(date));
    },

    async create(input: BookingInput, options: WriteOptions = {}): Promise<Booking> {
      const data: BookingInput = { ...input, title: normalizeTitle(input.title) };
      assertValid(data);

      return repository.transaction(async () => {
        await assertNoConflict(data);
        if (options.simulateConflict) throw simulatedConflict();
        return repository.insert(data);
      });
    },

    update(id: string, changes: BookingChanges, options: WriteOptions = {}): Promise<Booking> {
      return repository.transaction(async () => {
        const existing = await repository.findById(id);
        if (!existing) throw notFound();

        const updated: Booking = {
          ...existing,
          ...changes,
          id,
          title: normalizeTitle(changes.title ?? existing.title),
        };

        assertValid(updated);
        await assertNoConflict(updated, id);
        if (options.simulateConflict) throw simulatedConflict();
        await repository.replace(updated);
        return updated;
      });
    },

    async remove(id: string): Promise<void> {
      const removed = await repository.remove(id);
      if (!removed) throw notFound();
    },
  };
}

export type BookingService = ReturnType<typeof createBookingService>;
