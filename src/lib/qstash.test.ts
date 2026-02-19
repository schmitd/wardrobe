import { afterEach, describe, expect, it } from "bun:test";
import { getCallbackUrl } from "./qstash";

const ORIGINAL_ENV = {
  qstash: process.env.QSTASH_CALLBACK_BASE_URL,
  convexSite: process.env.CONVEX_SITE_URL,
  convexPublic: process.env.NEXT_PUBLIC_CONVEX_URL,
};

const clearCallbackEnv = () => {
  delete process.env.QSTASH_CALLBACK_BASE_URL;
  delete process.env.CONVEX_SITE_URL;
  delete process.env.NEXT_PUBLIC_CONVEX_URL;
};

afterEach(() => {
  if (ORIGINAL_ENV.qstash === undefined) {
    delete process.env.QSTASH_CALLBACK_BASE_URL;
  } else {
    process.env.QSTASH_CALLBACK_BASE_URL = ORIGINAL_ENV.qstash;
  }

  if (ORIGINAL_ENV.convexSite === undefined) {
    delete process.env.CONVEX_SITE_URL;
  } else {
    process.env.CONVEX_SITE_URL = ORIGINAL_ENV.convexSite;
  }

  if (ORIGINAL_ENV.convexPublic === undefined) {
    delete process.env.NEXT_PUBLIC_CONVEX_URL;
  } else {
    process.env.NEXT_PUBLIC_CONVEX_URL = ORIGINAL_ENV.convexPublic;
  }
});

describe("getCallbackUrl", () => {
  it("prefers QSTASH_CALLBACK_BASE_URL when multiple values exist", () => {
    process.env.QSTASH_CALLBACK_BASE_URL = "https://qstash.example.com/";
    process.env.CONVEX_SITE_URL = "https://site.example.com";
    process.env.NEXT_PUBLIC_CONVEX_URL = "https://public.example.com";

    expect(getCallbackUrl("/zep/sync")).toBe("https://qstash.example.com/zep/sync");
  });

  it("falls back to CONVEX_SITE_URL when QSTASH_CALLBACK_BASE_URL is missing", () => {
    clearCallbackEnv();
    process.env.CONVEX_SITE_URL = "https://site.example.com/";

    expect(getCallbackUrl("zep/sync")).toBe("https://site.example.com/zep/sync");
  });

  it("falls back to NEXT_PUBLIC_CONVEX_URL when other base URLs are missing", () => {
    clearCallbackEnv();
    process.env.NEXT_PUBLIC_CONVEX_URL = "https://public.example.com///";

    expect(getCallbackUrl("/zep/sync")).toBe("https://public.example.com/zep/sync");
  });

  it("throws a helpful error when no callback base URL is configured", () => {
    clearCallbackEnv();

    expect(() => getCallbackUrl("/zep/sync")).toThrow(
      "Missing QSTASH_CALLBACK_BASE_URL, CONVEX_SITE_URL, or NEXT_PUBLIC_CONVEX_URL for QStash callbacks"
    );
  });
});
