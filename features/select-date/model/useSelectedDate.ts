import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { isValidDateString, type DateString } from "@/shared/lib/time";

const PARAM = "date";

/**
 * The selected date lives in the URL (`?date=YYYY-MM-DD`): reload keeps it, Back works,
 * and a link can be shared. Without the param the page shows `today`, so a tab left open
 * overnight moves to the new day by itself.
 */
export function useSelectedDate(today: DateString | undefined) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const param = searchParams.get(PARAM);
  const date = param && isValidDateString(param) ? param : (today ?? null);

  const setDate = useCallback(
    (next: DateString) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next === today) params.delete(PARAM);
      else params.set(PARAM, next);
      const query = params.toString();
      router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams, today],
  );

  return { date, setDate };
}
