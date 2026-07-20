import { describe, expect, it } from "bun:test";

import { captureProtectionScopes } from "./captureProtection";

describe("native capture protection", () => {
  it("keeps routing and save analysis in separate burst-limit buckets", () => {
    expect(captureProtectionScopes.route).toBe("routing");
    expect(captureProtectionScopes.save).toBe("inference");
    expect(captureProtectionScopes.route).not.toBe(captureProtectionScopes.save);
  });
});
