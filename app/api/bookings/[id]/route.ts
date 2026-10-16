import type { NextRequest } from "next/server";
import { bookingService, handle, parseBookingChanges, readWriteOptions } from "@/server/bookings";

export function PATCH(request: NextRequest, ctx: RouteContext<"/api/bookings/[id]">) {
  return handle(async () => {
    const { id } = await ctx.params;
    const changes = await parseBookingChanges(request);
    return Response.json(await bookingService.update(id, changes, readWriteOptions(request)));
  });
}

export function DELETE(_request: NextRequest, ctx: RouteContext<"/api/bookings/[id]">) {
  return handle(async () => {
    const { id } = await ctx.params;
    await bookingService.remove(id);
    return new Response(null, { status: 204 });
  });
}
