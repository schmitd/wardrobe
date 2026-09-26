import { test, expect } from "playwright/test";

const photo = { name: "synthetic.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==", "base64") };

test("item photo preparation leaves no original-photo switch or completed status panel", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?scenario=wardrobe");
  await page.getByRole("button", { name: "Open Overshirt details", exact: true }).click();
  await page.getByRole("button", { name: "Prepare photo", exact: true }).click();
  await expect(page.getByRole("region", { name: "Photo status", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Use original photo", exact: true })).toHaveCount(0);
  const state = await page.request.get("/__fixture/state").then(r => r.json());
  expect(state.calls.filter((call: { input: { name: string } }) => call.input.name?.startsWith("garmentPreviewData.")).map((call: { input: { name: string } }) => call.input.name)).toEqual(["garmentPreviewData.request"]);
});

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
  await page.getByRole("button", { name: "Add outfit", exact: true }).click();
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("menuitem", { name: "Try on outfit", exact: true }).click();
  await (await chooser).setFiles(photo);
  await expect(page.getByRole("button", { name: "Add outfit", exact: true })).toBeDisabled();
  await expect(page.getByRole("heading", { name: "Strong closet fit", exact: true })).toBeVisible();
  const state = await page.request.get("/__fixture/state").then(r => r.json());
  expect(state.calls.find((call: { operation: string }) => call.operation === "try-on").input.scope).toBe("full_fit");
  expect(state.calls.some((call: { operation: string }) => ["create-piece", "daily-fit"].includes(call.operation))).toBe(false);
});

test("add menu connects to its trigger, supports keyboard dismissal and preserves picker cancellation", async ({ page }) => {
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/?scenario=wardrobe");
    const trigger = page.getByRole("button", { name: "Add outfit", exact: true });
    await page.emulateMedia({ reducedMotion: width === 320 ? "reduce" : "no-preference" });
    await trigger.click();
    const menu = page.getByRole("menu", { name: "Add outfit", exact: true });
    await expect(menu).toBeVisible();
    if (width === 390 || width === 1280) await page.screenshot({ path: `../../output/playwright/add-menu-${width}.png`, animations: "disabled" });
    await expect(page.getByRole("menuitem")).toHaveCount(2);
    expect(await page.getByRole("menuitem").evaluateAll(items => items.every(item => !item.hasAttribute("data-highlighted")))).toBe(true);
    const anchor = await page.getByRole("button", { name: "Close add menu", exact: true }).boundingBox();
    const bounds = await menu.boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
    expect(Math.abs(bounds!.x + bounds!.width / 2 - anchor!.x - anchor!.width / 2)).toBeLessThan(3);
    if (width === 320) expect(await menu.evaluate(element => getComputedStyle(element).animationName)).toBe("none");
    await menu.press("ArrowDown");
    await expect(page.getByRole("menuitem", { name: "Add owned outfit", exact: true })).toBeFocused();
    await page.getByRole("menuitem", { name: "Add owned outfit", exact: true }).press("ArrowDown");
    await expect(page.getByRole("menuitem", { name: "Try on outfit", exact: true })).toBeFocused();
    await page.getByRole("menuitem", { name: "Try on outfit", exact: true }).press("Escape");
    await expect(menu).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await trigger.click();
    const chooser = page.waitForEvent("filechooser");
    await page.getByRole("menuitem", { name: "Add owned outfit", exact: true }).click();
    await (await chooser).setFiles([]);
    await expect(menu).toHaveCount(0);
    await expect(trigger).toBeEnabled();
    await trigger.click();
    await expect(menu).toBeVisible();
    await page.getByRole("heading", { name: "All pieces", exact: true }).click();
    await expect(menu).toHaveCount(0);
  }
});
