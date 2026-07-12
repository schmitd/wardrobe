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
