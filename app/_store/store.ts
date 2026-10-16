import { configureStore } from "@reduxjs/toolkit";
import { createBrowserBookingsBaseQuery } from "@/demo-api/bookings";
import { baseApi, type ApiExtra } from "@/shared/api";
import { API_MODE } from "@/shared/config";

// A factory instead of a module-level singleton: on the server each request
// must get its own store so state never leaks between users.
export const makeStore = () => {
  // Creating the transport does not touch localStorage; it is only read when a request runs,
  // which happens in the browser after hydration.
  const extra: ApiExtra = {
    baseQuery: API_MODE === "browser" ? createBrowserBookingsBaseQuery() : undefined,
  };

  return configureStore({
    reducer: {
      [baseApi.reducerPath]: baseApi.reducer,
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({ thunk: { extraArgument: extra } }).concat(baseApi.middleware),
  });
};

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore["getState"]>;
export type AppDispatch = AppStore["dispatch"];
