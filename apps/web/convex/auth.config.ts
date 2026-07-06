import type { AuthConfig } from "convex/server";

const productionClerkIssuer = "https://clerk.wardrobe.davidcschmitt.com";
const clerkIssuers = [
  productionClerkIssuer,
  process.env.CLERK_JWT_ISSUER_DOMAIN,
]
  .map((issuer) => issuer?.trim())
  .filter((issuer): issuer is string => Boolean(issuer));

const providers = Array.from(new Set(clerkIssuers)).map((domain) => ({
  domain,
  applicationID: "convex",
}));

export default {
  providers,
} satisfies AuthConfig;
