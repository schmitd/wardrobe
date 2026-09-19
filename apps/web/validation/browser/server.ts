import { resolve } from "node:path";
import { shiftDay, sevenDays, type PlanningData } from "@wardrobe/shared";
import { boundedInteger } from "../property-options";

const port = boundedInteger(process.env.PROBE_PORT, 4173, 1024, 65535);
const boundary = resolve(import.meta.dir, "boundaries.tsx");
const modules: Record<string, string> = {
  "@clerk/nextjs": "useUser", "convex/react": "useQuery", "@convex/_generated/api": "api",
  "next/image": "Image as default", "next/link": "Link as default", "posthog-js": "analytics as default",
  "@/app/actions/wardrobe": "getUploadUrlAction, routeCaptureAction, recordDailyFitCheckAction, createWardrobeItemAction, checkCompatibilityAction, saveInspirationAction",
};
const build = await Bun.build({
  entrypoints: [resolve(import.meta.dir, "gallery.tsx")], target: "browser", minify: true,
  define: { "process.env.NODE_ENV": '"development"' },
  plugins: [{ name: "test-only-boundaries", setup(builder) {
    builder.onResolve({ filter: /^(?:@clerk\/nextjs|convex\/react|@convex\/_generated\/api|next\/image|next\/link|posthog-js|@\/app\/actions\/wardrobe)$/ }, args => ({ path: args.path, namespace: "test-boundary" }));
    builder.onLoad({ filter: /.*/, namespace: "test-boundary" }, args => ({ contents: `export { ${modules[args.path]} } from ${JSON.stringify(boundary)};`, loader: "tsx" }));
  } }],
});
if (!build.success) throw new AggregateError(build.logs, "Gallery build failed");
const bundle = build.outputs[0]!;
type State = { data: PlanningData; calls: { operation: string; input: Record<string, unknown> }[]; stale: boolean; latency: number; scope: string; wrote: boolean };
const states = new Map<string, State>();
function fixture(url: URL): State {
  // Match the Playwright/probe browser even when the runner's local date is UTC.
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  return {
    data: { items: ["Shirt", "Trousers", "Coat"].map((category, i) => ({ id: `piece-${i}`, category, description: `Synthetic ${category.toLowerCase()}`, imageUrl: null })), plans: [], calendarEnabled: true, calendarIds: ["synthetic-calendar"], suggestions: [{ id: "outfit", date: shiftDay(today, -1), title: "Yesterday's outfit", rationale: "Synthetic plan", itemIds: ["piece-0", "piece-1"], missing: [], context: [], status: "planned", calendarDerived: false }] },
    calls: [], stale: url.searchParams.get("case") === "stale", latency: boundedInteger(url.searchParams.get("latency") ?? undefined, 0, 0, 5000), scope: url.searchParams.get("scope") === "single_piece" ? "single_piece" : "full_fit", wrote: false,
  };
}
const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Wardrobe validation</title><style>body{font-family:system-ui;margin:24px;max-width:1100px}button,input,select,textarea{font:inherit;margin:6px;padding:8px}button{cursor:pointer}button:disabled{cursor:default;opacity:.5}svg{width:20px;height:20px}button svg{vertical-align:middle}li{margin:12px}img{max-width:200px}.hidden{display:none}[role=dialog]{position:fixed;inset:5%;overflow:auto;background:white;border:2px solid;padding:20px;z-index:2}[data-slot=dialog-overlay]{position:fixed;inset:0;background:#0008;z-index:1}header{margin-bottom:20px}</style><div id="root"></div><script type="module" src="/gallery.js"></script></html>`;
Bun.serve({ hostname: "127.0.0.1", port, async fetch(request) {
  const url = new URL(request.url);
  if (url.pathname === "/health") return new Response(process.env.PROBE_TOKEN ?? "ok");
  if (url.pathname === "/gallery.js") return new Response(bundle, { headers: { "Content-Type": "application/javascript" } });
  if (url.pathname === "/") {
    const session = crypto.randomUUID();
    if (states.size > 100) states.delete(states.keys().next().value!);
    states.set(session, fixture(url));
    return new Response(html, { headers: { "Content-Type": "text/html", "Set-Cookie": `probe_session=${session}; Path=/; HttpOnly; SameSite=Strict` } });
  }
  const session = request.headers.get("cookie")?.match(/(?:^|;\s*)probe_session=([^;]+)/)?.[1];
  const state = session ? states.get(session) : undefined;
  if (!state) return Response.json({ error: "Open a fixture first" }, { status: 400 });
  if (url.pathname === "/__fixture/state") return Response.json(state);
  if (url.pathname === "/__fixture/upload") return Response.json({ storageId: "synthetic-storage" });
  if (url.pathname === "/api/wardrobe/process-stream") return new Response('{"type":"status","stage":"persisting"}\n{"type":"complete"}\n', { headers: { "Content-Type": "application/x-ndjson" } });
  if (request.method !== "POST") return new Response("Not found", { status: 404 });
  const input = await request.json() as Record<string, unknown>;
  const operation = url.pathname === "/api/planning" ? String(input.operation) : url.pathname.split("/").at(-1)!;
  state.calls.push({ operation, input });
  if (state.calls.length > 200) state.calls.shift();
  if (state.latency) await Bun.sleep(state.latency);
  switch (operation) {
    case "planning_load": return state.stale && state.wrote ? Response.json({ error: "Synthetic refresh unavailable" }, { status: 503 }) : Response.json(state.data);
    case "planning_week": return Response.json({ days: [{ date: input.week, events: [{ title: "Synthetic meeting", start: "09:00" }], truncated: true }] });
    case "planning_interpret": return Response.json({ days: sevenDays(String(input.week)).map(date => ({ date, description: "予定".repeat(600) })), clarification: "" });
    case "planning_generate_week": state.wrote = true; return Response.json({ updated: 7, kept: 0 });
    case "planning_edit": state.data.suggestions[0]!.itemIds = input.itemIds as string[]; state.wrote = true; return Response.json({ ok: true });
    case "planning_worn": state.data.suggestions[0]!.status = "worn"; state.wrote = true; return Response.json({ ok: true });
    case "upload-url": return Response.json(`http://127.0.0.1:${port}/__fixture/upload`);
    case "route": return Response.json({ scope: state.scope, confidence: .95, needsReview: false, rationale: "Synthetic route" });
    case "daily-fit": return Response.json({ id: "synthetic-fit" });
    case "create-piece": return Response.json({ id: "synthetic-piece" });
    case "try-on": return Response.json({ storageId: "synthetic-storage", candidate: { category: "Full fit", description: "Synthetic two-piece fit", styleTags: [] }, evaluation: { score: 80, explanation: "Synthetic compatibility" }, similarItems: [], dissimilarItems: [], message: "Synthetic result" });
    default: return Response.json({ error: `Unimplemented fixture operation: ${operation}` }, { status: 400 });
  }
} });
console.log(`Synthetic browser gallery ready: http://127.0.0.1:${port}`);
