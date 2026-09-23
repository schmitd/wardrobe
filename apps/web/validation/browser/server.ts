import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import { collectionFixture, pieceSvg } from "./collection-fixture";
import { resolve } from "node:path";
import { shiftDay, sevenDays, type PlanningData, type WearOutfit } from "@wardrobe/shared";
import { boundedInteger } from "../property-options";

const port = boundedInteger(process.env.PROBE_PORT, 4173, 1024, 65535);
const boundary = resolve(import.meta.dir, "boundaries.tsx");
const modules: Record<string, string> = {
  "@clerk/nextjs": "useUser, SignedIn, SignedOut, SignInButton, UserButton", "convex/react": "useQuery, useMutation, usePaginatedQuery",
  "next/navigation": "usePathname, useSearchParams", "@convex/_generated/api": "api",
  "next/image": "Image as default", "next/link": "Link as default", "posthog-js": "analytics as default",
  "@/app/actions/wardrobe": "getUploadUrlAction, routeCaptureAction, recordDailyFitCheckAction, createWardrobeItemAction, checkCompatibilityAction, saveInspirationAction, enrichInspirationAction, deleteWardrobeItemAction, refreshStyleBioAction, updateProfileBioAction",
};
const build = await Bun.build({
  entrypoints: [resolve(import.meta.dir, "gallery.tsx")], target: "browser", minify: true,
  define: { "process.env.NODE_ENV": '"development"' },
  plugins: [{ name: "test-only-boundaries", setup(builder) {
    builder.onResolve({ filter: /^(?:@clerk\/nextjs|convex\/react|@convex\/_generated\/api|next\/image|next\/link|next\/navigation|posthog-js|@\/app\/actions\/wardrobe)$/ }, args => ({ path: args.path, namespace: "test-boundary" }));
    builder.onLoad({ filter: /.*/, namespace: "test-boundary" }, args => ({ contents: `export { ${modules[args.path]} } from ${JSON.stringify(boundary)};`, loader: "tsx" }));
  } }],
});
if (!build.success) throw new AggregateError(build.logs, "Gallery build failed");
const bundle = build.outputs[0]!;
type State = { wears: WearOutfit[]; catalog: ReturnType<typeof collectionFixture>; data: PlanningData; calls: { operation: string; input: Record<string, unknown> }[]; stale: boolean; latency: number; scope: string; wrote: boolean };
const states = new Map<string, State>();
function fixture(url: URL): State {
  // Match the Playwright/probe browser even when the runner's local date is UTC.
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  return {
    wears: [], catalog: collectionFixture(),
    data: { items: ["Shirt", "Trousers", "Coat"].map((category, i) => ({ id: `piece-${i}`, category, description: `Synthetic ${category.toLowerCase()}`, imageUrl: null })), plans: [], calendarEnabled: true, calendarIds: ["synthetic-calendar"], suggestions: [{ id: "outfit", date: url.searchParams.get("scenario") === "history" ? shiftDay(today, -1) : today, title: "Easy structure for your day", rationale: "Relaxed tailoring draws on Work edit; the cotton layers work together for your client meeting.", itemIds: ["piece-0", "piece-1"], missing: [], context: ["Collection: Work edit", "Style profile"], status: "planned", calendarDerived: false }] },
    calls: [], stale: url.searchParams.get("case") === "stale", latency: boundedInteger(url.searchParams.get("latency") ?? undefined, 0, 0, 5000), scope: url.searchParams.get("scope") === "single_piece" ? "single_piece" : "full_fit", wrote: false,
  };
}
const cssPath = resolve(import.meta.dir, "../../src/app/globals.css");
const css = await postcss([tailwind()]).process(await Bun.file(cssPath).text(), { from: cssPath });
const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Wardrobe review gallery</title><link rel="stylesheet" href="/gallery.css"><style>body{font-family:Arial,sans-serif}.fixture-banner{padding:5px 12px;background:#241426;color:#eee5f0;font-size:11px;text-align:center}</style><div id="root"></div><script type="module" src="/gallery.js"></script></html>`;
Bun.serve({ hostname: "127.0.0.1", port, async fetch(request) {
  const url = new URL(request.url);
  if (url.pathname === "/favicon.ico") return new Response(null, { status: 204 });
  if (url.pathname === "/health") return new Response(process.env.PROBE_TOKEN ?? "ok");
  if (url.pathname === "/gallery.js") return new Response(bundle, { headers: { "Content-Type": "application/javascript" } });
  if (url.pathname === "/gallery.css") return new Response(css.css, { headers: { "Content-Type": "text/css" } });
  if (/^\/__fixture\/piece-\d\.svg$/.test(url.pathname)) return new Response(pieceSvg(Number(url.pathname.match(/piece-(\d)/)?.[1])), { headers: { "Content-Type": "image/svg+xml" } });
  if (url.pathname === "/" || url.pathname === "/fits") {
    const session = crypto.randomUUID();
    if (states.size > 100) states.delete(states.keys().next().value!);
    const next = fixture(url);
    if (!url.searchParams.has("scenario") || url.searchParams.get("scenario") === "fits") {
      next.data.items = next.catalog.items.map(i => ({ id: i.id, category: i.category!, description: i.description!, imageUrl: i.imageUrl }));
      next.data.suggestions[0]!.status = "suggested";
      next.data.suggestions[0]!.itemIds = next.catalog.items.map(i => i.id);
    }
    if (url.searchParams.get("case") === "wear") {
      const plan = next.data.suggestions[0]!;
      plan.status = "planned"; plan.planRevision = 1; plan.date = shiftDay(plan.date, -1);
      next.wears.push({ id: "wear-photo", revision: 1, localDate: plan.date, itemIds: [plan.itemIds[0]!], pieces: next.data.items.slice(0, 1), photos: [{ id: "fit-photo", imageUrl: "/__fixture/piece-0.svg" }], unresolvedCount: 1, coverage: "partial", outcome: "unconfirmed", canUndoManual: false, recordedAt: Date.now() });
    }
    states.set(session, next);
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
  if (url.pathname === "/__fixture/query") {
    const args = input.args as Record<string, string>;
    const c = state.catalog;
    switch (input.query) {
      case "mobile.plans": case "wardrobes.listWardrobes": return Response.json(c.collections);
      case "wardrobe.pageCollections": return Response.json(c.collections.map(collection => ({ ...collection, previews: [...c.items.filter(i => c.memberships.some(m => m.wardrobeId === collection._id && m.itemId === i.id)), ...c.inspirations.filter(r => r.wardrobeId === collection._id).map(r => ({ id: r._id, imageUrl: r.imageUrl, category: r.category }))].slice(0, 3) })));
      case "wardrobe.pageWardrobeItems": return Response.json(c.items);
      case "wardrobe.pagePieces": return Response.json(c.items.filter(i => c.memberships.some(m => m.wardrobeId === args.wardrobeId && m.itemId === i.id)));
      case "wardrobe.itemDetails": return Response.json({ note: c.items.find(i => i.id === args.itemId)?.note ?? "", collections: c.collections.filter(collection => c.memberships.some(m => m.itemId === args.itemId && m.wardrobeId === collection._id)).map(collection => ({ id: collection._id, name: collection.name })), truncated: false });
      case "wardrobe.itemCollectionMembership": return Response.json(c.memberships.some(m => m.itemId === args.itemId && m.wardrobeId === args.wardrobeId));
      case "profile.getProfile": return Response.json({ bio: c.bio });
      case "planning.load": return Response.json({ ...state.data, suggestions: state.data.suggestions.map(plan => ({ ...plan, _id: plan.id, createdAt: Date.now() })) });
      case "wear.pendingPlans": return Response.json(state.data.suggestions.filter(plan => plan.status === "planned").map(plan => ({ ...plan, revision: plan.planRevision ?? 0, pieces: state.data.items.filter(item => plan.itemIds.includes(item.id)) })));
      case "wear.list": return Response.json(state.wears);
      case "fitChecks.pageFitChecks": return Response.json(state.wears.flatMap(wear => wear.photos.map(photo => ({ _id: photo.id, type: "daily_fit_check", imageUrl: photo.imageUrl, localDate: wear.localDate, wearOccurrenceId: wear.id, createdAt: wear.recordedAt, observations: [], description: "Synthetic photo notes should stay collapsed." }))));
      case "wardrobe.pageInspiration": case "candidates.listInspirationByWardrobe": return Response.json(c.inspirations.filter(r => r.wardrobeId === args.wardrobeId));
      default: return Response.json([]);
    }
  }
  const operation = url.pathname === "/api/planning" ? String(input.operation) : url.pathname.split("/").at(-1)!;
  state.calls.push({ operation, input });
  if (state.calls.length > 200) state.calls.shift();
  if (state.latency) await Bun.sleep(state.latency);
  switch (operation) {
    case "mutation": {
      const args = input.args as Record<string, string>; const c = state.catalog;
      if (input.name === "wardrobe.getUploadUrl") return Response.json(`http://127.0.0.1:${port}/__fixture/upload`);
      if (input.name === "candidates.createInspiration") { const id = `reference-${c.inspirations.length}`; c.inspirations.unshift({ _id: id, wardrobeId: args.wardrobeId!, category: args.category!, description: args.description!, imageUrl: "/__fixture/piece-0.svg" }); return Response.json({ id }); }
      if (input.name === "wardrobe.saveNote") { const item = c.items.find(i => i.id === args.itemId); if (item) item.note = args.note.trim(); }
      else if (input.name === "wardrobes.addItemToWardrobe") { if (!c.memberships.some(m => m.itemId === args.itemId && m.wardrobeId === args.wardrobeId)) c.memberships.push({ itemId: args.itemId!, wardrobeId: args.wardrobeId! }); }
      else if (input.name === "wardrobes.removeItemFromWardrobe") c.memberships = c.memberships.filter(m => !(m.itemId === args.itemId && m.wardrobeId === args.wardrobeId));
      else if (input.name === "wardrobes.updateWardrobe") { const collection = c.collections.find(collection => collection._id === args.wardrobeId); if (collection) { collection.name = args.name!; collection.description = args.description ?? ""; } }
      else if (input.name === "wardrobes.createWardrobe") { const id = `collection-${c.collections.length}`; c.collections.push({ _id: id, name: args.name!, description: args.description ?? "" }); return Response.json({ id }); }
      return Response.json(null);
    }
    case "enrich-inspiration": return Response.json({ success: true });
    case "update-bio": state.catalog.bio = String(input.bio); return Response.json({ success: true });
    case "planning_accept": state.data.suggestions[0]!.status = "planned"; return Response.json({ ok: true });
    case "planning_load": return state.stale && state.wrote ? Response.json({ error: "Synthetic refresh unavailable" }, { status: 503 }) : Response.json(state.data);
    case "planning_week": return Response.json({ days: [{ date: input.week, events: [{ title: "Synthetic meeting", start: "09:00" }], truncated: true }] });
    case "planning_interpret": return Response.json({ days: sevenDays(String(input.week)).map(date => ({ date, description: "予定".repeat(600) })), clarification: "" });
    case "planning_generate_week": state.wrote = true; return Response.json({ updated: 7, kept: 0 });
    case "planning_edit": state.data.suggestions[0]!.itemIds = input.itemIds as string[]; state.wrote = true; return Response.json({ ok: true });
    case "planning_worn": {
      const plan = state.data.suggestions[0]!; plan.status = "worn"; state.wrote = true;
      const itemIds = input.itemIds as string[] ?? plan.itemIds;
      if (!state.wears.some(wear => wear.planId === plan.id)) state.wears.push({ id: "wear-manual", planId: plan.id, revision: 1, localDate: plan.date, itemIds, pieces: state.data.items.filter(item => itemIds.includes(item.id)), photos: [], unresolvedCount: 0, coverage: "supported", outcome: "worn_differently", canUndoManual: true, recordedAt: Date.now() });
      plan.wearOccurrenceId = "wear-manual";
      return Response.json({ ok: true });
    }
    case "planning_not_worn": case "planning_clear_response": state.data.suggestions[0]!.notWornAt = operation === "planning_not_worn" ? Date.now() : undefined; return Response.json({ ok: true });
    case "wear_update": {
      const wear = state.wears.find(row => row.id === input.id)!;
      if (input.action === "correct") { wear.itemIds = input.itemIds as string[]; wear.pieces = state.data.items.filter(item => wear.itemIds.includes(item.id)); wear.canUndoManual = true; wear.unresolvedCount = 0; }
      if (input.action === "set_date") wear.localDate = String(input.localDate);
      if (input.action === "undo_manual" && wear.photos.length === 0) { state.wears = state.wears.filter(row => row.id !== wear.id); state.data.suggestions[0]!.status = "planned"; }
      wear.revision++; return Response.json({ ok: true });
    }
    case "upload-url": return Response.json(`http://127.0.0.1:${port}/__fixture/upload`);
    case "route": return Response.json({ scope: state.scope, confidence: .95, needsReview: false, rationale: "Synthetic route" });
    case "daily-fit": return Response.json({ id: "synthetic-fit" });
    case "create-piece": return Response.json({ id: "synthetic-piece" });
    case "try-on": return Response.json({ storageId: "synthetic-storage", candidate: { category: "Full fit", description: "Synthetic two-piece fit", styleTags: [] }, evaluation: { score: 80, explanation: "Synthetic compatibility" }, similarItems: [], dissimilarItems: [], message: "Synthetic result" });
    default: return Response.json({ error: `Unimplemented fixture operation: ${operation}` }, { status: 400 });
  }
} });
console.log(`Synthetic browser gallery ready: http://127.0.0.1:${port}`);
