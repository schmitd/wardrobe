import { describe, it, expect } from "bun:test";
import { ensureTraceContext } from "./trace";

const traceparentRegex =
  /^[\da-f]{2}-([\da-f]{32})-([\da-f]{16})-[\da-f]{2}$/i;

describe("convex trace context", () => {
  it("accepts a valid traceparent", () => {
    const traceparent = `00-${"d".repeat(32)}-${"e".repeat(16)}-01`;
    const result = ensureTraceContext({ traceparent });
    expect(result.traceparent).toBe(traceparent);
    expect(result.traceId).toBe("d".repeat(32));
  });

  it("builds traceparent when traceId provided", () => {
    const traceId = "f".repeat(32);
    const result = ensureTraceContext({ traceId });
    expect(result.traceId).toBe(traceId);
    expect(traceparentRegex.test(result.traceparent)).toBe(true);
  });

  it("generates a trace context when input is empty", () => {
    const result = ensureTraceContext();
    expect(traceparentRegex.test(result.traceparent)).toBe(true);
    expect(result.traceId).toHaveLength(32);
  });

  it("rejects all-zero trace IDs from traceparent", () => {
    const traceparent = `00-${"0".repeat(32)}-${"e".repeat(16)}-01`;
    const result = ensureTraceContext({ traceparent });
    expect(result.traceId).not.toBe("0".repeat(32));
  });

  it("rejects all-zero traceId input", () => {
    const result = ensureTraceContext({ traceId: "0".repeat(32) });
    expect(result.traceId).not.toBe("0".repeat(32));
  });
});
