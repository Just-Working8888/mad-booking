import { toMinuteRange, type Booking } from "@/entities/booking/model";
import { createTransactionQueue, type BookingRepository } from "@/server/bookings/repository";
import { isValidDateString } from "@/shared/lib/time";

export const STORAGE_KEY = "meeting-room-demo:bookings:v1";

/** Writing to the browser storage failed: storage disabled, quota exceeded, private mode, etc. */
export class StorageWriteError extends Error {
  constructor(options?: { cause?: unknown }) {
    super("Не удалось записать данные в хранилище браузера", options);
    this.name = "StorageWriteError";
  }
}

type StoredData = {
  version: 1;
  bookings: Booking[];
};

type Options = {
  /** Resolves the storage lazily on each access; `null` where there is none (SSR, blocked storage). */
  getStorage?: () => Storage | null;
  key?: string;
  generateId?: () => string;
  /** Called when stored data is unreadable or partly invalid; such data is dropped, not trusted. */
  onCorruptedData?: () => void;
};

function browserLocalStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    // Merely reading `window.localStorage` throws when storage is blocked by browser settings.
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Shape check for data that came from storage: anyone (or another app version) could have written it. */
function isStoredBooking(value: unknown): value is Booking {
  if (typeof value !== "object" || value === null) return false;
  const { id, date, start, end, title } = value as Record<string, unknown>;
  return (
    typeof id === "string" &&
    typeof date === "string" &&
    isValidDateString(date) &&
    typeof start === "string" &&
    typeof end === "string" &&
    toMinuteRange({ start, end }) !== null &&
    (title === undefined || typeof title === "string")
  );
}

/**
 * `BookingRepository` on top of `localStorage`, for the in-browser demo.
 * Every operation re-reads storage, so changes made in another tab are picked up.
 * `transaction` serializes work within this tab only: localStorage gives no atomicity across tabs.
 */
export function createLocalStorageBookingRepository({
  getStorage = browserLocalStorage,
  key = STORAGE_KEY,
  generateId = () => crypto.randomUUID(),
  onCorruptedData,
}: Options = {}): BookingRepository {
  // Every operation re-reads storage; report the same broken value only once, not on each read.
  let reportedRaw: string | null = null;
  const reportCorrupted = (raw: string) => {
    if (raw === reportedRaw) return;
    reportedRaw = raw;
    onCorruptedData?.();
  };

  const read = (): Booking[] => {
    const storage = getStorage();
    if (!storage) return [];

    let raw: string | null;
    try {
      raw = storage.getItem(key);
    } catch {
      return [];
    }
    if (raw === null) return [];

    try {
      const parsed = JSON.parse(raw) as Partial<StoredData> | null;
      if (!parsed || !Array.isArray(parsed.bookings)) {
        reportCorrupted(raw);
        return [];
      }
      const valid = parsed.bookings.filter(isStoredBooking);
      if (valid.length !== parsed.bookings.length) reportCorrupted(raw);
      return valid;
    } catch {
      reportCorrupted(raw);
      return [];
    }
  };

  const write = (bookings: Booking[]): void => {
    const storage = getStorage();
    if (!storage) throw new StorageWriteError();
    try {
      storage.setItem(key, JSON.stringify({ version: 1, bookings } satisfies StoredData));
    } catch (cause) {
      throw new StorageWriteError({ cause });
    }
  };

  return {
    async listByDate(date) {
      return read().filter((booking) => booking.date === date);
    },

    async findById(id) {
      return read().find((booking) => booking.id === id);
    },

    async insert(input) {
      const booking: Booking = { id: generateId(), ...input };
      write([...read(), booking]);
      return booking;
    },

    async replace(booking) {
      write(read().map((existing) => (existing.id === booking.id ? booking : existing)));
    },

    async remove(id) {
      const bookings = read();
      const rest = bookings.filter((booking) => booking.id !== id);
      if (rest.length === bookings.length) return false;
      write(rest);
      return true;
    },

    transaction: createTransactionQueue(),
  };
}
