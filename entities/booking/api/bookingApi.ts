import type { FetchBaseQueryError } from "@reduxjs/toolkit/query";
import { baseApi } from "@/shared/api";
import type { Booking, BookingChanges, BookingInput } from "../model";

/** Demo switch: asks the mock server to answer 409 as if someone took the slot first. */
type DemoOptions = {
  simulateConflict?: boolean;
};

type CreateBookingArgs = DemoOptions & {
  input: BookingInput;
};

type UpdateBookingArgs = DemoOptions & {
  id: string;
  changes: BookingChanges;
};

const demoHeaders = ({ simulateConflict }: DemoOptions) =>
  simulateConflict ? { "x-simulate-conflict": "1" } : undefined;

/** Tag for "the list of bookings on this date". */
const dateListTag = (date: string) => ({ type: "Booking" as const, id: `date:${date}` });

/**
 * After a mutation the list must be refetched not only on success but also when the server
 * says our picture is stale: 409 (someone took the slot) or 404 (the booking is gone).
 */
function shouldRefetch(error: FetchBaseQueryError | undefined): boolean {
  return !error || error.status === 409 || error.status === 404;
}

export const bookingApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getBookings: build.query<Booking[], string>({
      query: (date) => ({ url: "bookings", params: { date } }),
      providesTags: (result, _error, date) => [
        dateListTag(date),
        ...(result ?? []).map(({ id }) => ({ type: "Booking" as const, id })),
      ],
    }),

    createBooking: build.mutation<Booking, CreateBookingArgs>({
      query: ({ input, ...options }) => ({
        url: "bookings",
        method: "POST",
        body: input,
        headers: demoHeaders(options),
      }),
      invalidatesTags: (_result, error, { input }) =>
        shouldRefetch(error) ? [dateListTag(input.date)] : [],
    }),

    updateBooking: build.mutation<Booking, UpdateBookingArgs>({
      query: ({ id, changes, ...options }) => ({
        url: `bookings/${id}`,
        method: "PATCH",
        body: changes,
        headers: demoHeaders(options),
      }),
      // The booking's own tag refreshes the list it was in; the date tag covers a move to another day.
      invalidatesTags: (result, error, { id, changes }) => {
        if (!shouldRefetch(error)) return [];
        const targetDate = result?.date ?? changes.date;
        return [{ type: "Booking", id }, ...(targetDate ? [dateListTag(targetDate)] : [])];
      },
    }),

    deleteBooking: build.mutation<void, string>({
      query: (id) => ({ url: `bookings/${id}`, method: "DELETE" }),
      invalidatesTags: (_result, error, id) => (shouldRefetch(error) ? [{ type: "Booking", id }] : []),
    }),
  }),
});

export const {
  usePrefetch: useBookingsPrefetch,
  useGetBookingsQuery,
  useCreateBookingMutation,
  useUpdateBookingMutation,
  useDeleteBookingMutation,
} = bookingApi;
