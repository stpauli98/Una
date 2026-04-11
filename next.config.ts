import type { NextConfig } from "next";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseHostname = supabaseUrl ? new URL(supabaseUrl).hostname : "127.0.0.1";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 2592000,
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
