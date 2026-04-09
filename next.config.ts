import type { NextConfig } from "next";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseHostname = supabaseUrl ? new URL(supabaseUrl).hostname : "127.0.0.1";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: supabaseUrl?.startsWith("https") ? "https" : "http",
        hostname: supabaseHostname,
        port: supabaseHostname === "127.0.0.1" ? "54321" : "",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
