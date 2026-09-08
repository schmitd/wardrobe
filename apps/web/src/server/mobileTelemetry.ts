import { auth } from "@clerk/nextjs/server";
import { after } from "next/server";
import { PostHog } from "posthog-node";
import { ensureTraceContext } from "@/lib/trace";
import { linkedAnalyticsSession, safeMobileOperation } from "./mobileTelemetryCore";

// API boundaries report only bounded operation names, never request/response bodies.

export async function observeMobileRequest(request: Request, endpoint: "capture" | "manage" | "bootstrap" | "upload_url", execute: (request: Request, traceId: string) => Promise<Response>) {
  const started = Date.now();
  const trace = ensureTraceContext({ traceId: request.headers.get("X-Wardrobe-Trace-ID") });
  let operation: string = endpoint;
  if (endpoint === "capture" || endpoint === "manage") {
    try {
      const body = await request.clone().json();
      operation = safeMobileOperation(body?.operation);
    } catch { operation = "invalid_request"; }
  }
  let userId: string | null = null;
  try { userId = (await auth()).userId; } catch { /* actual handler owns auth */ }
  // Next.js may pass a proxied Request. Reconstructing it with the native
  // Request constructor trips Undici's private-field brand checks in Node.
  // Preserve the framework request and pass normalized trace context separately.
  let response: Response;
  try { response = await execute(request, trace.traceId); }
  catch { response = Response.json({ error: "Wardrobe could not complete this request." }, { status: 500 }); }
  response.headers.set("X-Wardrobe-Trace-ID", trace.traceId);
  const properties = {
    endpoint, operation, status: response.status,
    outcome: response.ok ? "success" : "failure",
    duration_ms: Date.now() - started,
    trace_id: trace.traceId,
    source: "native_api",
    environment: process.env.VERCEL_ENV ?? "development",
    git_sha: process.env.VERCEL_GIT_COMMIT_SHA ?? "local",
    analytics_schema: 1,
  };
  // Client IDs are correlation hints, never authorization. Only accept a session
  // paired with the authenticated opaque user ID, preventing cross-user attribution.
  const linkedSession = linkedAnalyticsSession(request.headers, userId);
  after(async () => {
    const tasks: Promise<unknown>[] = [];
    const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
    const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;
    if (token && host && userId && linkedSession) tasks.push(Promise.resolve().then(async () => {
      const client = new PostHog(token, { host, flushAt: 1, flushInterval: 0, requestTimeout: 3000, fetchRetryCount: 0, disableGeoip: true });
      client.capture({ distinctId: userId, event: "native_operation_finished", properties: { ...properties, ...(linkedSession ? { $session_id: linkedSession } : {}) } });
      await client.shutdown();
    }));
    const axiomToken = process.env.AXIOM_TOKEN;
    const dataset = process.env.AXIOM_DATASET;
    if (axiomToken && dataset) tasks.push(fetch(`https://api.axiom.co/v1/datasets/${encodeURIComponent(dataset)}/ingest`, {
      method: "POST", signal: AbortSignal.timeout(3000),
      headers: { Authorization: `Bearer ${axiomToken}`, "Content-Type": "application/json" },
      body: JSON.stringify([{ _time: new Date().toISOString(), event: "mobile.request.finished", service: "wardrobe-web", ...properties }]),
    }).then((result) => { if (!result.ok) throw new Error("Axiom ingestion rejected"); }));
    const results = await Promise.allSettled(tasks);
    if (results.some((result) => result.status === "rejected")) console.warn("mobile.telemetry.delivery_failed");
  });
  return response;
}
