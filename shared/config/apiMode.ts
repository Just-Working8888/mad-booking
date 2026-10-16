/**
 * Where the bookings API lives:
 * - `server`  — Next.js Route Handlers with an in-memory store (local development, default);
 * - `browser` — in-browser demo transport backed by localStorage (public demo on Vercel).
 *
 * Set via `NEXT_PUBLIC_API_MODE` at build time; `next.config.ts` defaults it to `browser` on Vercel.
 */
export type ApiMode = "server" | "browser";

export const API_MODE: ApiMode = process.env.NEXT_PUBLIC_API_MODE === "browser" ? "browser" : "server";
