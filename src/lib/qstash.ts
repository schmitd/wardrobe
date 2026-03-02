const normalizeBaseUrl = (baseUrl: string) => baseUrl.replace(/\/+$/, "");

export const getCallbackUrl = (path: string) => {
  const baseUrl =
    process.env.QSTASH_CALLBACK_BASE_URL ||
    process.env.CONVEX_SITE_URL ||
    process.env.NEXT_PUBLIC_CONVEX_URL;

  if (!baseUrl) {
    throw new Error(
      "Missing QSTASH_CALLBACK_BASE_URL, CONVEX_SITE_URL, or NEXT_PUBLIC_CONVEX_URL for QStash callbacks"
    );
  }

  const normalized = normalizeBaseUrl(baseUrl);
  return `${normalized}${path.startsWith("/") ? path : `/${path}`}`;
};

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const toErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

const shouldRetryStatus = (status: number) => status === 429 || status >= 500;

const getSharedSecretHeader = (): Record<string, string> => {
  const secret = process.env.WARDROBE_SYNC_SHARED_SECRET;
  if (!secret) {
    return {};
  }
  return { "x-wardrobe-sync-secret": secret };
};

export const publishJson = async <T>(
  path: string,
  body: T,
  options?: { retries?: number; delay?: number; headers?: Record<string, string> }
) => {
  const url = getCallbackUrl(path);
  const retries = options?.retries ?? 5;
  const attempts = Math.max(1, retries + 1);
  const initialDelayMs = options?.delay ?? 0;

  if (initialDelayMs > 0) {
    await sleep(initialDelayMs);
  }

  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...getSharedSecretHeader(),
          ...(options?.headers ?? {}),
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        if (attempt < attempts - 1 && shouldRetryStatus(response.status)) {
          await sleep(200 * (attempt + 1));
          continue;
        }
        throw new Error(`Webhook publish failed (${response.status}): ${response.statusText}`);
      }

      return { url, status: response.status };
    } catch (error) {
      lastError = error;
      if (attempt < attempts - 1) {
        await sleep(200 * (attempt + 1));
        continue;
      }
    }
  }

  throw new Error(`Webhook publish failed: ${toErrorMessage(lastError)}`);
};
