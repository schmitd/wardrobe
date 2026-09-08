import { describe, expect, it } from "bun:test";
import { linkedAnalyticsSession, safeMobileOperation } from "./mobileTelemetryCore";

describe("mobile server telemetry", () => {
  const session = "019b9fb2-c5fb-4000-a11b-1832d2e6f127";
  it("accepts only known operations, not injected free text", () => {
    expect(safeMobileOperation("record_fit")).toBe("record_fit");
    expect(safeMobileOperation("secret@example.com")).toBe("unknown");
    expect(safeMobileOperation({ password: "secret" })).toBe("unknown");
  });
  it("correlates only a session paired with authenticated identity", () => {
    const headers = new Headers({ "X-POSTHOG-DISTINCT-ID": "user_123", "X-POSTHOG-SESSION-ID": session });
    expect(linkedAnalyticsSession(headers, "user_123")).toBe(session);
    expect(linkedAnalyticsSession(headers, "other_user")).toBeUndefined();
    expect(linkedAnalyticsSession(headers, null)).toBeUndefined();
  });
  it("does not send backend product events for opted-out clients or invalid sessions", () => {
    expect(linkedAnalyticsSession(new Headers(), "user_123")).toBeUndefined();
    expect(linkedAnalyticsSession(new Headers({ "X-POSTHOG-DISTINCT-ID": "user_123", "X-POSTHOG-SESSION-ID": "private-text" }), "user_123")).toBeUndefined();
  });
});
