import { test, expect } from "playwright/test";

const photo = { name: "synthetic.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==", "base64") };

test("planner: adjust yesterday's outfit from history and preserve saved-but-stale feedback", async ({ page }) => {
  await page.goto("/?scenario=history");
  await page.getByText("Swap a piece", { exact: true }).click();
  await page.getByRole("button", { name: "Add a piece", exact: true }).click();
  await page.getByLabel("Add an owned piece").selectOption("piece-2");
  await expect(page.getByRole("article").getByText("Synthetic coat", { exact: true })).toBeVisible();
  await page.getByRole("listitem").filter({ hasText: "Synthetic shirt" }).getByRole("button", { name: "Remove", exact: true }).click();
  await expect(page.getByRole("article").getByText("Synthetic shirt", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "I wore this", exact: true }).click();
  await expect(page.getByText("Recorded as worn.", { exact: true })).toBeVisible();
  const state = await page.request.get("/__fixture/state").then(r => r.json());
  expect(state.data.suggestions[0].itemIds).toEqual(["piece-1", "piece-2"]);

  await page.goto("/?scenario=history&case=stale");
  await page.getByRole("button", { name: "I wore this", exact: true }).click();
  await expect(page.getByText("Saved. The view could not refresh; reload to see your change.", { exact: true })).toBeVisible();
});

test("planner: review seven multilingual days, retain the selected week, and disclose partial Calendar", async ({ page }) => {
  await page.goto("/?scenario=planner");
  await expect(page.getByText("Partial calendar · some events are not shown")).toBeVisible();
  const week = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  await page.getByRole("button", { name: "Describe your day or week…", exact: false }).click();
  await page.getByLabel("Your week", { exact: true }).fill("七日間の予定を確認してください");
  await page.getByRole("button", { name: "Review days", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Activities", exact: true })).toHaveCount(7);
  await page.getByRole("button", { name: "Suggest outfits for 6 days", exact: true }).click();
  await expect(page.getByText("7 days updated", { exact: true })).toBeVisible();
  const state = await page.request.get("/__fixture/state").then(r => r.json());
  const input = state.calls.find((call: { operation: string }) => call.operation === "planning_generate_week").input;
  expect(input.week).toBe(week);
  expect(new TextEncoder().encode(JSON.stringify(input)).length).toBeGreaterThan(16_000);
  expect(new TextEncoder().encode(JSON.stringify(input)).length).toBeLessThan(40_000);
});

test("capture: a delayed full-fit try-on retains intent without adding owned pieces", async ({ page }) => {
  await page.goto("/?scenario=capture&latency=150");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("menuitem", { name: /Just trying/ }).click();
  await (await chooser).setFiles(photo);
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page.getByRole("menuitem", { name: /My wardrobe/ }).click();
  await expect(page.getByRole("heading", { name: "Strong closet fit", exact: true })).toBeVisible();
  const state = await page.request.get("/__fixture/state").then(r => r.json());
  expect(state.calls.find((call: { operation: string }) => call.operation === "try-on").input.scope).toBe("full_fit");
  expect(state.calls.some((call: { operation: string }) => ["create-piece", "daily-fit"].includes(call.operation))).toBe(false);
});
