import type { NextRequest } from "next/server";
import {
  bookingService,
  handle,
  parseBookingInput,
  parseDateParam,
  readWriteOptions,
} from "@/server/bookings";

export function GET(request: NextRequest) {
  return handle(async () => {
    const date = parseDateParam(request.nextUrl.searchParams.get("date"));
    return Response.json(await bookingService.list(date));
  });
}

export function POST(request: NextRequest) {
  return handle(async () => {
    const input = await parseBookingInput(request);
    const booking = await bookingService.create(input, readWriteOptions(request));
    return Response.json(booking, { status: 201 });
  });
}
