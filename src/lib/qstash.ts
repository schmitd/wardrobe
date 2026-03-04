import { Client } from "@upstash/qstash";

const token = process.env.QSTASH_TOKEN;
const qstashClient = token ? new Client({ token }) : null;

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

export const publishJson = async <T>(
  path: string,
  body: T,
  options?: { retries?: number; delay?: number; headers?: Record<string, string> }
) => {
  if (!qstashClient) {
    throw new Error("QSTASH_TOKEN is not set");
  }

  return qstashClient.publishJSON({
    url: getCallbackUrl(path),
    body,
    retries: options?.retries ?? 5,
    delay: options?.delay,
    headers: options?.headers,
  });
};
