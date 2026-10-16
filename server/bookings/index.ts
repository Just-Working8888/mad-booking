import { getRoomNow } from "@/entities/booking/model";
import { createInMemoryBookingRepository, type BookingRepository } from "./repository";
import { createBookingService } from "./service";

export { errorResponse, handle, parseBookingChanges, parseBookingInput, readWriteOptions } from "./http";
export { parseDateParam } from "./protocol";

// Route handlers can be bundled separately and dev HMR re-evaluates modules, so the store lives
// on globalThis to stay a single instance per server process.
const globalStore = globalThis as typeof globalThis & {
  bookingRepository?: BookingRepository;
};

globalStore.bookingRepository ??= createInMemoryBookingRepository();

export const bookingService = createBookingService({
  repository: globalStore.bookingRepository,
  now: () => getRoomNow(),
});
