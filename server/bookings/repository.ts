import type { Booking, BookingInput } from "@/entities/booking/model";

/**
 * Storage contract for bookings. The service depends only on this interface,
 * so the in-memory implementation can be swapped for a real database.
 */
export interface BookingRepository {
  listByDate(date: string): Promise<Booking[]>;
  findById(id: string): Promise<Booking | undefined>;
  insert(input: BookingInput): Promise<Booking>;
  replace(booking: Booking): Promise<void>;
  remove(id: string): Promise<boolean>;
  /**
   * Runs `work` with exclusive access to the storage, making a read-check-write sequence atomic.
   * A database implementation would use a transaction (or an exclusion constraint) instead.
   */
  transaction<T>(work: () => Promise<T>): Promise<T>;
}

/**
 * Serializes async work: each call starts after the previous one settled. Gives the in-process
 * atomicity `BookingRepository.transaction` promises (within one JS runtime, not across processes).
 */
export function createTransactionQueue(): BookingRepository["transaction"] {
  // Tail of the queue of pending transactions.
  let queue: Promise<unknown> = Promise.resolve();
  return (work) => {
    const result = queue.then(work);
    // A failed transaction must not block the ones queued after it.
    queue = result.catch(() => undefined);
    return result;
  };
}

export function createInMemoryBookingRepository(
  generateId: () => string = () => crypto.randomUUID(),
): BookingRepository {
  const bookings = new Map<string, Booking>();

  return {
    async listByDate(date) {
      return [...bookings.values()].filter((booking) => booking.date === date);
    },

    async findById(id) {
      return bookings.get(id);
    },

    async insert(input) {
      const booking: Booking = { id: generateId(), ...input };
      bookings.set(booking.id, booking);
      return booking;
    },

    async replace(booking) {
      bookings.set(booking.id, booking);
    },

    async remove(id) {
      return bookings.delete(id);
    },

    transaction: createTransactionQueue(),
  };
}
