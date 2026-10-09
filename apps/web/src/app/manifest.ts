import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Lint",
    short_name: "Lint",
    description: "Your wardrobe and outfit planner.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#D8C9DC",
    theme_color: "#241426",
    prefer_related_applications: false,
    icons: [
      { src: "/brand/lint-app-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/brand/lint-app-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
