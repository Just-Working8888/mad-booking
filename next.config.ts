import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    agentFeedback: true,
  },
  env: {
    // Bookings API mode (see shared/config/apiMode.ts). An explicit value always wins;
    // otherwise Vercel builds get the in-browser demo, since the in-memory server store
    // does not survive across serverless instances.
    NEXT_PUBLIC_API_MODE: process.env.NEXT_PUBLIC_API_MODE ?? (process.env.VERCEL ? "browser" : "server"),
  },
  sassOptions: {
    // Lets SCSS modules write `@use "shared/styles/breakpoints"` instead of long relative paths.
    loadPaths: [process.cwd()],
  },
};

export default nextConfig;
