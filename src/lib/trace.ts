const toHex = (bytes: Uint8Array) =>
  Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");

const randomBytes = (length: number) => {
  if (globalThis.crypto?.getRandomValues) {
    const buffer = new Uint8Array(length);
    globalThis.crypto.getRandomValues(buffer);
    return buffer;
  }

  throw new Error("Secure random source unavailable");
};

const traceparentRegex =
  /^[\da-f]{2}-([\da-f]{32})-([\da-f]{16})-[\da-f]{2}$/i;

const buildTraceparent = (traceId: string) =>
  `00-${traceId}-${toHex(randomBytes(8))}-01`;

const isAllZeros = (value: string) => /^0+$/i.test(value);

export const createTraceContext = () => {
  const traceId = toHex(randomBytes(16));
  return { traceId, traceparent: buildTraceparent(traceId) };
};

export const ensureTraceContext = (input?: {
  traceId?: string | null;
  traceparent?: string | null;
}) => {
  const traceparent = input?.traceparent?.trim();
  if (traceparent && traceparentRegex.test(traceparent)) {
    const [, traceId, spanId] = traceparent.split("-");
    if (!isAllZeros(traceId) && !isAllZeros(spanId)) {
      return { traceId, traceparent };
    }
  }

  const traceId = input?.traceId?.trim();
  if (traceId && /^[\da-f]{32}$/i.test(traceId) && !isAllZeros(traceId)) {
    return { traceId, traceparent: buildTraceparent(traceId) };
  }

  return createTraceContext();
};
