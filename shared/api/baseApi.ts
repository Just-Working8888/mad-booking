import {
  createApi,
  fetchBaseQuery,
  type BaseQueryFn,
  type FetchArgs,
  type FetchBaseQueryError,
} from "@reduxjs/toolkit/query/react";

export type ApiBaseQuery = BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError>;

/**
 * Thunk extra argument of the store. Lets the app layer swap the transport (e.g. for the
 * in-browser demo) without `shared` knowing about any concrete implementation.
 */
export type ApiExtra = {
  baseQuery?: ApiBaseQuery;
};

const httpBaseQuery = fetchBaseQuery({ baseUrl: "/api" });

const baseQuery: ApiBaseQuery = (args, api, extraOptions) => {
  const transport = (api.extra as ApiExtra | undefined)?.baseQuery ?? httpBaseQuery;
  return transport(args, api, extraOptions);
};

/**
 * Single RTK Query API instance. Entities inject their endpoints into it
 * via `baseApi.injectEndpoints`, so the store only needs to know about this one.
 * Swapping the mock for a real backend means changing `baseUrl` only.
 */
export const baseApi = createApi({
  reducerPath: "api",
  baseQuery,
  tagTypes: ["Booking"],
  endpoints: () => ({}),
});
