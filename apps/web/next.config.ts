import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@wardrobe/context-client", "@wardrobe/shared"],
  // Sharp loads its platform packages dynamically, so Next's file tracer does
  // not discover libvips on its own. Include both Linux runtime packages in the
  // /fits server function instead of shipping only the sharp native binding.
  outputFileTracingIncludes: {
    "/fits": [
      "./node_modules/@img/sharp-linux-x64/**/*",
      "./node_modules/@img/sharp-libvips-linux-x64/**/*",
      "../../node_modules/@img/sharp-linux-x64/**/*",
      "../../node_modules/@img/sharp-libvips-linux-x64/**/*",
    ],
  },
  // Keep analytics first-party so ad blockers do not silently remove product signals.
  // The more-specific static route must come before the catch-all proxy.
  async rewrites() {
    return [
      {
        source: "/ingest/static/:path*",
        destination: "https://us-assets.i.posthog.com/static/:path*",
      },
      {
        source: "/ingest/:path*",
        destination: "https://us.i.posthog.com/:path*",
      },
    ];
  },
  skipTrailingSlashRedirect: true,
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
