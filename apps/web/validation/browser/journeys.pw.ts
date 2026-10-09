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
  await page.getByRole("region", { name: "Choose a piece" }).getByRole("button", { name: /Synthetic coat/ }).click();
  await expect(page.getByRole("dialog").getByText("Synthetic coat", { exact: true })).toBeVisible();
  await page.getByRole("listitem").filter({ hasText: "Synthetic shirt" }).getByRole("button", { name: "Remove", exact: true }).click();
  await expect(page.getByRole("dialog").getByText("Synthetic shirt", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page.getByRole("button", { name: "I wore this", exact: true }).click();
  await expect(page.getByText("Recorded as worn.", { exact: true })).toBeVisible();
  const state = await page.request.get("/__fixture/state").then(r => r.json());
  expect(state.data.suggestions[0].itemIds).toEqual(["piece-1", "piece-2"]);

  await page.goto("/?scenario=history&case=stale");
  await page.getByRole("button", { name: "I wore this", exact: true }).click();
  await expect(page.getByText("Saved. The view could not refresh; reload to see your change.", { exact: true })).toBeVisible();
});

test("planner: one action generates multilingual days and discloses partial Calendar", async ({ page }) => {
  await page.goto("/?scenario=planner");
  await expect(page.getByText("Partial calendar · some events are not shown")).toBeVisible();
  const week = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  await page.getByRole("button", { name: "Describe your day or week", exact: false }).click();
  await page.getByLabel("Describe your day or week", { exact: true }).fill("七日間の予定を確認してください");
  await expect(page.getByRole("textbox")).toHaveCount(1);
  await page.getByRole("button", { name: "Update outfits", exact: true }).click();
  await expect(page.getByText("6 days updated · 1 chosen outfit kept", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your updated outfit", exact: true })).toBeVisible();
  const state = await page.request.get("/__fixture/state").then(r => r.json());
  const input = state.calls.find((call: { operation: string }) => call.operation === "planning_generate_week").input;
  expect(input.week).toBe(week);
  expect(new TextEncoder().encode(JSON.stringify(input)).length).toBeGreaterThan(16_000);
  expect(new TextEncoder().encode(JSON.stringify(input)).length).toBeLessThan(40_000);
});

test("capture: a delayed full-fit try-on retains intent without adding owned pieces", async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: () => new Promise(() => {}) } }); });
  await page.goto("/?scenario=capture&latency=150");
  await page.getByRole("button", { name: "Add outfit", exact: true }).click();
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Try on", exact: true }).click();
  await page.getByRole("button", { name: "Choose photos", exact: true }).click();
  await (await chooser).setFiles(photo);
  await expect(page.getByRole("button", { name: "Add outfit", exact: true })).toBeDisabled();
  await expect(page.getByRole("heading", { name: "Strong closet fit", exact: true })).toBeVisible();
  const state = await page.request.get("/__fixture/state").then(r => r.json());
  expect(state.calls.find((call: { operation: string }) => call.operation === "try-on").input.scope).toBe("full_fit");
  expect(state.calls.some((call: { operation: string }) => ["create-piece", "daily-fit"].includes(call.operation))).toBe(false);
});

test("Add enters full viewport camera, restores focus and preserves picker cancellation", async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: () => new Promise(() => {}) } }); });
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/?scenario=wardrobe");
    const trigger = page.getByRole("button", { name: "Add outfit", exact: true });
    await trigger.click();
    const camera = page.getByRole("dialog", { name: "Camera", exact: true });
    await expect(camera).toBeVisible();
    await expect(page.getByRole("menu")).toHaveCount(0);
    await expect(page.locator(".task-sheet")).toHaveCount(0);
    expect(await camera.boundingBox()).toEqual({ x: 0, y: 0, width, height: 844 });
    await expect(page.getByRole("button", { name: "Close camera" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(camera).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await trigger.click();
    const chooser = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "Choose photos", exact: true }).click();
    await (await chooser).setFiles([]);
    await expect(camera).toHaveCount(0);
    await expect(trigger).toBeEnabled();
    await trigger.click();
    await expect(camera).toBeVisible();
    await page.getByRole("button", { name: "Close camera", exact: true }).click();
  }
});

test("drawers keep their frame, garment and actions fixed through details and collection choices", async ({ page }) => {
  for (const { width, height } of [{ width: 320, height: 844 }, { width: 390, height: 844 }, { width: 1280, height: 844 }, { width: 390, height: 500 }]) {
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/?scenario=wardrobe&latency=80");
    const rack = page.getByRole("region", { name: "Closet rack", exact: true });
    await expect(rack).toBeVisible();
    const position = () => rack.evaluate(element => element.getBoundingClientRect().top + window.scrollY);
    const top = await position();
    await page.getByRole("button", { name: "Work edit", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Work edit", exact: true })).toBeVisible();
    await expect(rack).toBeVisible();
    expect(Math.abs(await position() - top)).toBeLessThan(1);
    await page.getByRole("button", { name: "Open Overshirt details", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    const geometry = () => dialog.evaluate(element => [element, element.querySelector('.task-sheet-hero')!, element.querySelector('.task-sheet-footer')!].map(e => {
      const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height };
    }));
    const before = await geometry();
    expect(before[2]!.y + before[2]!.height).toBeLessThanOrEqual(height);
    expect(await dialog.locator(".task-sheet-body").evaluate(element => element.clientHeight)).toBeGreaterThan(100);
    await dialog.getByRole("button", { name: /^Collections/ }).click();
    await dialog.getByRole("checkbox", { name: "Weekend", exact: true }).click();
    await expect(dialog.getByRole("checkbox", { name: "Weekend", exact: true })).toBeChecked();
    await expect(dialog.getByText("Collections updated.", { exact: true })).toBeVisible();
    expect(await geometry()).toEqual(before);
    await dialog.press("Escape");
    await expect(dialog.getByRole("button", { name: /^Collections/ })).toBeFocused();
    await dialog.getByRole("button", { name: /^My note/ }).click();
    await dialog.getByRole("textbox", { name: "My note", exact: true }).fill("A long useful note. ".repeat(90));
    expect(await geometry()).toEqual(before);
    await dialog.getByRole("button", { name: "Save note", exact: true }).click();
    await expect(dialog.getByText("Note saved.", { exact: true })).toBeVisible();
    expect(await geometry()).toEqual(before);
    await page.screenshot({ path: `../../output/playwright/item-drawer-${width}-${height}.png`, animations: "disabled" });
    await dialog.press("Escape");
    await dialog.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Open Overshirt details", exact: true })).toBeFocused();
    await page.getByRole("button", { name: "Edit collection", exact: true }).click();
    expect((await page.getByRole("dialog").boundingBox())!.width).toBe(width < 640 ? width : 440);
    await page.getByRole("dialog").press("Escape");
    await expect(page.getByRole("button", { name: "Edit collection", exact: true })).toBeFocused();
  }
});

test("planner retains a failed draft, retries generation, and asks clarification without submitting ambiguous dates", async ({ page }) => {
  await page.goto("/?scenario=planner&case=generation-error");
  await page.getByRole("button", { name: "Describe your day or week", exact: true }).click();
  const input = page.getByRole("textbox", { name: "Describe your day or week", exact: true });
  await input.fill("My week has meetings and dinners");
  await page.getByRole("button", { name: "Update outfits", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Synthetic generation failed");
  await expect(input).toHaveValue("My week has meetings and dinners");
  await page.getByRole("button", { name: "Update outfits", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const state = await page.request.get("/__fixture/state").then(r => r.json());
  expect(state.calls.filter((call: { operation: string }) => call.operation === "planning_interpret")).toHaveLength(1);
  expect(state.calls.filter((call: { operation: string }) => call.operation === "planning_generate_week")).toHaveLength(2);
  await page.goto("/?scenario=planner&case=clarify");
  await page.getByRole("button", { name: "Describe your day or week", exact: true }).click();
  await input.fill("Meeting that day");
  await page.getByRole("button", { name: "Update outfits", exact: true }).click();
  await expect(page.getByText("Which day is the meeting? Edit your description above, then update again.")).toBeVisible();
  const ambiguous = await page.request.get("/__fixture/state").then(r => r.json());
  expect(ambiguous.calls.some((call: { operation: string }) => call.operation === "planning_generate_week")).toBe(false);
});

test("dictation transcribes on finish and discards cancelled recordings", async ({ page }) => {
  await page.addInitScript(() => {
    const track = { stop() {} };
    Object.defineProperty(navigator, "mediaDevices", { value: { getUserMedia: async () => ({ getTracks: () => [track] }) } });
    class Recorder {
      state = "inactive"; mimeType = "audio/webm";
      onstop: (() => void) | null = null;
      ondataavailable: ((event: { data: Blob }) => void) | null = null;
      start() { this.state = "recording"; }
      stop() { this.state = "inactive"; this.ondataavailable?.({ data: new Blob(["synthetic audio"]) }); queueMicrotask(() => this.onstop?.()); }
    }
    Object.defineProperty(window, "MediaRecorder", { value: Recorder });
  });
  await page.goto("/?scenario=planner");
  await page.getByRole("button", { name: "Describe your day or week", exact: true }).click();
  await page.getByRole("button", { name: "Tap to dictate", exact: true }).click();
  await page.getByRole("button", { name: "Tap to finish", exact: true }).click();
  await expect(page.getByRole("textbox")).toHaveValue("Dinner today and a walk on Sunday.");
  await page.getByRole("button", { name: "Tap to dictate", exact: true }).click();
  await page.getByRole("button", { name: "Cancel dictation", exact: true }).click();
  await expect(page.getByRole("button", { name: "Tap to dictate", exact: true })).toBeVisible();
  const state = await page.request.get("/__fixture/state").then(r => r.json());
  expect(state.calls.filter((call: { operation: string }) => call.operation === "transcribe")).toHaveLength(1);
  expect(state.calls.some((call: { operation: string }) => call.operation === "planning_generate_week")).toBe(false);
});
