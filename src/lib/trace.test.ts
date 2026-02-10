import { describe, it, expect } from "bun:test";
import { createTraceContext, ensureTraceContext } from "./trace";

const traceparentRegex =
  /^[\da-f]{2}-([\da-f]{32})-([\da-f]{16})-[\da-f]{2}$/i;

describe("trace context utilities", () => {
  it("respects a valid traceparent", () => {
    const traceparent = `00-${"a".repeat(32)}-${"b".repeat(16)}-01`;
    const result = ensureTraceContext({ traceparent });
    expect(result.traceparent).toBe(traceparent);
    expect(result.traceId).toBe("a".repeat(32));
  });

  it("builds traceparent from traceId", () => {
    const traceId = "c".repeat(32);
    const result = ensureTraceContext({ traceId });
    expect(result.traceId).toBe(traceId);
    expect(traceparentRegex.test(result.traceparent)).toBe(true);
  });

  it("creates a new trace context when none provided", () => {
    const result = createTraceContext();
    expect(traceparentRegex.test(result.traceparent)).toBe(true);
    expect(result.traceId).toHaveLength(32);
  });
});
