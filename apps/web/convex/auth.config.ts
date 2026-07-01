import type { AuthConfig } from "convex/server";

const productionClerkIssuer = "https://clerk.wardrobe.davidcschmitt.com";
const clerkAudience = process.env.CLERK_JWT_AUDIENCE || "convex";
const clerkIssuers = [
  productionClerkIssuer,
  process.env.CLERK_JWT_ISSUER_DOMAIN,
  ...(process.env.CLERK_ADDITIONAL_JWT_ISSUER_DOMAINS?.split(",") ?? []),
]
  .map((issuer) => issuer?.trim())
  .filter((issuer): issuer is string => Boolean(issuer));

const providers = Array.from(new Set(clerkIssuers)).map((domain) => ({
  domain,
  applicationID: clerkAudience,
}));

export default {
  providers,
} satisfies AuthConfig;
