import { test, expect } from "playwright/test";

for (const failure of ["create", "completion"] as const) test(`guest import ${failure} failure retries explicitly, reuses IDs and stays complete after reload`, async ({ page }) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem("synthetic-import-seeded")) return;
    const dataUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==";
    sessionStorage.setItem("wardrobe.guestSnapshot.v1", JSON.stringify({ version: 1, createdAt: 1000, bio: "Synthetic style note", sourceFit: { fileName: "fit.png", mimeType: "image/png", dataUrl, transcription: "Synthetic outfit" }, items: [0, 1, 2].map(index => ({ id: `guest-${index}`, fileName: `piece-${index}.png`, mimeType: "image/png", dataUrl, category: "Shirt", description: "Synthetic piece", styleTags: [], ...(index === 0 ? { createdItemId: "already-created" } : {}) })) }));
    sessionStorage.setItem("synthetic-import-seeded", "1");
  });
  await page.goto(`/?scenario=home-import&case=import-${failure}-error&latency=80`);
  const retry = page.getByRole("button", { name: "Retry import", exact: true });
  await expect(retry).toBeVisible();
  const before = await page.request.get("/__fixture/state").then(r => r.json());
  expect(before.calls.filter((call: { operation: string }) => call.operation === "create-piece")).toHaveLength(2);
  const saved = await page.evaluate(() => JSON.parse(sessionStorage.getItem("wardrobe.guestSnapshot.v1")!).items);
  expect(saved[0].createdItemId).toBe("already-created");
  expect(saved[1].createdItemId).toBe("synthetic-piece-1");
  await retry.click();
  await expect(retry).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem("wardrobe.guestSnapshot.v1"))).toBeNull();
  const completed = await page.request.get("/__fixture/state").then(r => r.json());
  expect(completed.calls.filter((call: { operation: string }) => call.operation === "create-piece")).toHaveLength(failure === "create" ? 3 : 2);
  const last = completed.calls.filter((call: { operation: string }) => call.operation === "complete-onboarding").at(-1);
  expect(last.input.items.map((item: { itemId: string }) => item.itemId)).toEqual(["already-created", "synthetic-piece-1", failure === "create" ? "synthetic-piece-3" : "synthetic-piece-2"]);
  await page.reload(); await expect(page.getByRole("heading", { name: "Wardrobe", exact: true })).toBeAttached();
  const reloaded = await page.request.get("/__fixture/state").then(r => r.json());
  expect(reloaded.calls.filter((call: { operation: string }) => call.operation === "create-piece")).toHaveLength(failure === "create" ? 3 : 2);
  await expect(retry).toHaveCount(0);
});
