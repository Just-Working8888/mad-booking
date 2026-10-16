"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Provider } from "react-redux";
import { setupListeners } from "@reduxjs/toolkit/query";
import { makeStore } from "../_store/store";

export function StoreProvider({ children }: { children: ReactNode }) {
  // Lazy initial state creates the store exactly once per client mount.
  const [store] = useState(makeStore);

  // Enables `refetchOnFocus` / `refetchOnReconnect`: the schedule refreshes when the user returns.
  useEffect(() => setupListeners(store.dispatch), [store]);

  return <Provider store={store}>{children}</Provider>;
}
