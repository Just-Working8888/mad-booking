import { Suspense } from "react";
import { BookingPage } from "@/views/booking";

export default function Page() {
  return (
    // The page reads the selected date from the URL (useSearchParams), which needs a Suspense boundary.
    <Suspense>
      <BookingPage />
    </Suspense>
  );
}
