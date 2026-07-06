import type { AuthConfig } from "convex/server";

const productionClerkIssuer = "https://clerk.wardrobe.davidcschmitt.com";
const clerkAudience = "convex";
const clerkIssuers = [productionClerkIssuer]
  .map((issuer) => issuer?.trim())
  .filter((issuer): issuer is string => Boolean(issuer));

const providers = Array.from(new Set(clerkIssuers)).map((domain) => ({
  domain,
  applicationID: clerkAudience,
}));

export default {
  providers,
} satisfies AuthConfig;
