// Synthetic, development-only integration check. Never reads or changes a tester's wardrobe.
// Run with a DEVELOPMENT Clerk key and the dedicated review session in PLANNING_REVIEW_SESSION.
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { localDate, type PlanningData } from "@wardrobe/shared";

if (!process.env.CLERK_SECRET_KEY?.startsWith("sk_test_") || !process.env.PLANNING_REVIEW_SESSION || process.env.NEXT_PUBLIC_CONVEX_URL !== "https://confident-lobster-971.convex.cloud") throw new Error("This smoke test requires the designated development environment and review session.");
const headers = { Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`, "Content-Type": "application/json" };
const session = process.env.PLANNING_REVIEW_SESSION;
async function token(template = "") {
  const response = await fetch(`https://api.clerk.com/v1/sessions/${session}/tokens${template ? `/${template}` : ""}`, { method: "POST", headers, body: "{}" });
  const result = await response.json();
  if (!response.ok || !result.jwt) throw new Error("Test session unavailable");
  return result.jwt as string;
}
const client = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
client.setAuth(await token("convex"));
async function request<T>(body: object): Promise<T> {
  const response = await fetch("http://localhost:3000/api/planning", { method: "POST", headers: { Authorization: `Bearer ${await token()}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!response.ok) throw new Error(`Planning endpoint returned ${response.status}`);
  return response.json();
}
const before = await request<PlanningData>({ operation: "planning_load" });
if (before.items.length) throw new Error("Review inventory is not empty; refusing to change existing data.");
for (const [category, description] of [["Top", "Synthetic fixture: plain navy cotton shirt"], ["Bottoms", "Synthetic fixture: straight grey trousers"], ["Shoes", "Synthetic fixture: comfortable black walking shoes"], ["Layer", "Synthetic fixture: lightweight neutral cardigan"]]) {
  const uploadUrl = await client.mutation(api.wardrobe.getUploadUrl, {});
  // Non-personal app artwork is only a storage placeholder; no image inference is run.
  const upload = await fetch(uploadUrl, { method: "POST", headers: { "Content-Type": "image/png" }, body: await Bun.file("../mobile/assets/icon.png").arrayBuffer() });
  const { storageId } = await upload.json();
  const created = await client.mutation(api.wardrobe.createWardrobeItem, { storageId, contentType: "image/png" });
  await client.mutation(api.wardrobe.applyDescription, { itemId: created.id, category, description });
}
const generated = await request<{ id: string }>({ operation: "planning_generate", date: localDate(), timezone: "America/New_York", description: "Synthetic test day: office, a lunchtime walk, then a casual dinner. Comfortable layers.", useCalendar: false });
const data = await request<PlanningData>({ operation: "planning_load" });
const outfit = data.suggestions.find(s => s.id === generated.id);
if (!outfit || !outfit.itemIds.length || outfit.itemIds.some(id => !data.items.some(i => i.id === id))) throw new Error("Un-grounded recommendation");
await request({ operation: "planning_accept", id: generated.id });
await request({ operation: "planning_edit", id: generated.id, itemIds: data.items.slice(0, 3).map(i => i.id) });
await request({ operation: "planning_worn", id: generated.id, itemIds: data.items.slice(1, 4).map(i => i.id) });
const after = await request<PlanningData>({ operation: "planning_load" });
const worn = after.suggestions.find(s => s.id === generated.id);
if (worn?.status !== "worn" || worn.itemIds.join() !== data.items.slice(1, 4).map(i => i.id).join()) throw new Error("Worn changes were not persisted");
console.log(JSON.stringify({ passed: true, inventoryCount: data.items.length, recommendedPieceCount: outfit.itemIds.length, finalStatus: worn.status, actualPiecesPersisted: true }));
