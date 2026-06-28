import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@wardrobe/context-client", "@wardrobe/shared"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.convex.site",
      },
      {
        protocol: "https",
        hostname: "*.convex.cloud",
      },
      {
        protocol: "https",
        hostname: "utfs.io",
      },
    ],
  },
};

export default nextConfig;
