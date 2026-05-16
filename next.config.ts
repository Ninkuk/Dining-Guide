import type { NextConfig } from "next";
import { withBotId } from "botid/next/config";

const supabaseHost = new URL(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co",
).hostname;

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: supabaseHost,
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

// Wrap with BotID so Vercel injects the fingerprinting JS only on the routes
// listed in instrumentation-client.ts. No-op locally and on non-Vercel hosts.
export default withBotId(nextConfig);
