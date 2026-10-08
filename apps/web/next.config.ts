import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@kalndlord/shared"],
  experimental: {
    // Photo uploads pass through a server action: up to 8 photos of 5 MB each.
    serverActions: { bodySizeLimit: "42mb" },
  },
};

export default nextConfig;
