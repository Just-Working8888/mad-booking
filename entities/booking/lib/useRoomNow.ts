import { useSyncExternalStore } from "react";
import type { LocalDateTime } from "@/shared/lib/time";
import { getRoomNow } from "../model";

const MINUTE = 60_000;

let snapshot: LocalDateTime | null = null;

/** Returns the same object until the minute changes, as useSyncExternalStore requires. */
function getSnapshot(): LocalDateTime {
  const next = getRoomNow();
  if (!snapshot || snapshot.date !== next.date || snapshot.minutes !== next.minutes) {
    snapshot = next;
  }
  return snapshot;
}

function subscribe(onChange: () => void): () => void {
  let timer: ReturnType<typeof setTimeout>;
  // Fire right after each minute boundary (Bishkek is a whole-hour offset, so they align with UTC).
  const schedule = () => {
    timer = setTimeout(() => {
      onChange();
      schedule();
    }, MINUTE - (Date.now() % MINUTE) + 50);
  };
  // Background tabs throttle timers; catch up as soon as the tab is visible again.
  const onVisibilityChange = () => {
    if (document.visibilityState === "visible") onChange();
  };

  schedule();
  document.addEventListener("visibilitychange", onVisibilityChange);
  return () => {
    clearTimeout(timer);
    document.removeEventListener("visibilitychange", onVisibilityChange);
  };
}

/**
 * Current office time, re-rendering once a minute.
 * `null` during SSR and hydration: the server can't know the visitor's "now",
 * so time-dependent UI renders only on the client.
 */
export function useRoomNow(): LocalDateTime | null {
  return useSyncExternalStore(subscribe, getSnapshot, () => null);
}
