import type { AuthConfig } from "convex/server";

const productionClerkIssuer = "https://clerk.wardrobe.davidcschmitt.com";
const developmentClerkIssuer = "https://beloved-guppy-95.clerk.accounts.dev";
const clerkAudience = "convex";
const clerkIssuers = [productionClerkIssuer, developmentClerkIssuer]
  .map((issuer) => issuer?.trim())
  .filter((issuer): issuer is string => Boolean(issuer));

const providers = Array.from(new Set(clerkIssuers)).map((domain) => ({
  domain,
  applicationID: "convex",
}));

export default {
  providers,
} satisfies AuthConfig;
