// Development-only live AI and persistence test, restricted to the synthetic review account.
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { localDate, shiftDay, type PlanningData } from "@wardrobe/shared";

const session = process.env.PLANNING_REVIEW_SESSION;
if (
  !process.env.CLERK_SECRET_KEY?.startsWith("sk_test_") ||
  !session ||
  process.env.NEXT_PUBLIC_CONVEX_URL !==
    "https://confident-lobster-971.convex.cloud"
)
  throw Error("Designated development environment required.");
const headers = {
  Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
  "Content-Type": "application/json",
};
const info = await fetch(`https://api.clerk.com/v1/sessions/${session}`, {
  headers,
}).then((r) => r.json());
if (info.user_id !== "user_3JH8gnZHvJHVscTJgpaI5T9Vw3K")
  throw Error("Dedicated review account required.");
async function token(template = "") {
  const response = await fetch(
    `https://api.clerk.com/v1/sessions/${session}/tokens${template ? `/${template}` : ""}`,
    { method: "POST", headers, body: "{}" },
  );
  const result = await response.json();
  if (!response.ok || !result.jwt) throw Error("Test session unavailable.");
  return result.jwt as string;
}
const client = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL);
client.setAuth(await token("convex"));
async function request<T>(body: object): Promise<T> {
  const response = await fetch("http://localhost:3001/api/planning", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${await token()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!response.ok)
    throw Error(
      `${(body as { operation: string }).operation} returned ${response.status}: ${(await response.json()).error}`,
    );
  return response.json();
}
const before = await request<PlanningData>({ operation: "planning_load" });
if (before.items.some((i) => !i.description.startsWith("Synthetic fixture:")))
  throw Error("Non-synthetic inventory; refusing mutations.");
if (!before.items.length) {
  for (const [category, description] of [
    ["Top", "plain navy cotton shirt"],
    ["Bottoms", "straight grey trousers"],
    ["Shoes", "black walking shoes"],
    ["Layer", "neutral cardigan"],
  ]) {
    const url = await client.mutation(api.wardrobe.getUploadUrl, {});
    const upload = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "image/png" },
      body: await Bun.file("../mobile/assets/icon.png").arrayBuffer(),
    });
    const { storageId } = await upload.json();
    const item = await client.mutation(api.wardrobe.createWardrobeItem, {
      storageId,
      contentType: "image/png",
    });
    await client.mutation(api.wardrobe.applyDescription, {
      itemId: item.id,
      category,
      description: `Synthetic fixture: ${description}`,
    });
  }
}
const dates = [22, 24, 26].map((n) => shiftDay(localDate(), n));
const days = dates.map((date) => ({
  date,
  description:
    "Synthetic test: office, a walk, then casual dinner. Comfortable layers.",
}));
const operation = {
  operation: "planning_generate_week",
  days,
  timezone: "America/New_York",
  useCalendar: false,
};
await request(operation);
const generated = await request<PlanningData>({ operation: "planning_load" });
const outfits = dates.map((date) =>
  generated.suggestions.find((s) => s.date === date),
);
if (
  outfits.some(
    (s) =>
      !s ||
      !s.itemIds.length ||
      s.itemIds.some((id) => !generated.items.some((i) => i.id === id)),
  )
)
  throw Error("Ungrounded or missing week recommendation.");
const ids = generated.items.slice(0, 3).map((i) => i.id);
if (outfits[0]!.status === "suggested")
  await request({ operation: "planning_accept", id: outfits[0]!.id });
await request({ operation: "planning_edit", id: outfits[0]!.id, itemIds: ids });
if (outfits[1]!.status === "suggested")
  await request({ operation: "planning_accept", id: outfits[1]!.id });
if (outfits[1]!.status !== "worn")
  await request({
    operation: "planning_worn",
    id: outfits[1]!.id,
    itemIds: ids,
  });
await Bun.sleep(31000);
const result = await request<{ updated: number; kept: number }>(operation);
const after = await request<PlanningData>({ operation: "planning_load" });
const planned = after.suggestions.find((s) => s.id === outfits[0]!.id);
const worn = after.suggestions.find((s) => s.id === outfits[1]!.id);
if (
  planned?.status !== "planned" ||
  worn?.status !== "worn" ||
  planned.itemIds.join() !== ids.join() ||
  worn.itemIds.join() !== ids.join() ||
  result.kept !== 2 ||
  result.updated !== 1
)
  throw Error("Week regeneration changed a committed outfit.");
console.log(
  JSON.stringify({
    passed: true,
    daysGenerated: 3,
    ownedPiecesOnly: true,
    editedPiecesPersisted: true,
    plannedAndWornProtected: true,
    ...result,
  }),
);
