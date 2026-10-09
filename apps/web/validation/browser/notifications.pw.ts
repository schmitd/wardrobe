import { test, expect } from "playwright/test";
import { cameraFixture } from "./camera-fixture";
test.beforeEach(async ({page}) => { await cameraFixture(page); });

const photo = { name: "synthetic.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==", "base64") };

async function choosePhoto(page: import("playwright/test").Page) {
  await page.getByRole("button", { name: "Add outfit", exact: true }).click();
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Choose photos", exact: true }).click();
  await (await chooser).setFiles(photo);
}

async function addPiece(page: import("playwright/test").Page) {
  await choosePhoto(page);
  await expect(page.getByText("Piece added.", { exact: true })).toBeVisible();
}

test("capture notice can be dismissed with a pointer or keyboard inside Labels without covering actions", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?scenario=wardrobe&scope=single_piece");
  await addPiece(page);
  await page.getByRole("button", { name: "Open Overshirt details", exact: true }).click();
  await page.getByRole("button", { name: /^Labels/ }).click();
  const dialog = page.getByRole("dialog");
  const dismiss = dialog.getByRole("button", { name: "Dismiss notification", exact: true });
  await expect(dismiss).toBeVisible();
  await dialog.getByRole("button", { name: "Save labels", exact: true }).scrollIntoViewIfNeeded();
  await expect(dialog.getByRole("button", { name: "Save labels", exact: true })).toBeInViewport();
  const noticeBox = (await dialog.getByRole("region", { name: "Notifications" }).boundingBox())!;
  const saveBox = (await dialog.getByRole("button", { name: "Save labels", exact: true }).boundingBox())!;
  expect(noticeBox.y + noticeBox.height).toBeLessThanOrEqual(saveBox.y);
  await dismiss.click(); // No force: the real hit target must be available.
  await expect(page.getByText("Piece added.", { exact: true })).toHaveCount(0);
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Back to piece", exact: true }).click();
  await dialog.getByRole("button", { name: "Done", exact: true }).click();
  await expect(page.getByRole("button", { name: "Open Overshirt details", exact: true })).toBeFocused();

  await addPiece(page);
  await page.getByRole("button", { name: "Open Overshirt details", exact: true }).click();
  await page.keyboard.press("F8");
  await expect(dialog.getByRole("region", { name: "Notifications" })).toBeFocused();
  await page.keyboard.press("Tab"); // Optional success link.
  await expect(dialog.getByRole("link", { name: "Piece added.", exact: true })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(dismiss).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByText("Piece added.", { exact: true })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);

  await addPiece(page);
  await page.getByRole("button", { name: "Open Overshirt details", exact: true }).click();
  await page.keyboard.press("F8");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await expect(dismiss).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByText("Piece added.", { exact: true })).toHaveCount(0);
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});

test("success timers survive overlay changes, pause for reading and keep repeated notices distinct", async ({ page }) => {
  await page.goto("/?scenario=notifications");
  await page.clock.install();
  await page.getByRole("button", { name: "Success notice", exact: true }).click();
  await page.mouse.move(0, 0);
  await page.clock.fastForward(3000);
  await page.getByRole("button", { name: "Open task", exact: true }).click();
  await page.clock.fastForward(2001);
  await expect(page.getByText("Piece added.", { exact: true })).toHaveCount(0);
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Success notice", exact: true }).click();
  await dialog.getByRole("button", { name: "Success notice", exact: true }).click();
  await expect(dialog.getByText("Piece added.", { exact: true })).toHaveCount(2);
  const dismiss = dialog.getByRole("button", { name: "Dismiss notification", exact: true });
  await dismiss.first().click();
  await expect(dialog.getByText("Piece added.", { exact: true })).toHaveCount(1);
  await dialog.getByText("Piece added.", { exact: true }).hover();
  await page.clock.fastForward(6000);
  await expect(dialog.getByText("Piece added.", { exact: true })).toBeVisible();
  await page.keyboard.press("F8");
  await page.keyboard.press("Tab");
  await expect(dismiss).toBeFocused();
  await page.mouse.move(0, 0);
  await page.clock.fastForward(6000);
  await expect(dialog.getByText("Piece added.", { exact: true })).toBeVisible();
  await page.keyboard.press("Tab");
  await page.clock.fastForward(5001);
  await expect(dialog.getByText("Piece added.", { exact: true })).toHaveCount(0);
  await dialog.getByRole("button", { name: "Back to wardrobe", exact: true }).click();
  await page.getByRole("button", { name: "Success notice", exact: true }).click();
  const other = await page.context().newPage();
  // Playwright forces every Chromium page to report focus, even in a background tab.
  // Disable that harness emulation to exercise the browser's actual visibility state.
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setFocusEmulationEnabled", { enabled: false });
  await other.bringToFront();
  await expect.poll(() => page.evaluate(() => document.hidden || !document.hasFocus())).toBe(true);
  await page.clock.fastForward(6000);
  await expect(page.getByText("Piece added.", { exact: true })).toBeVisible();
  await other.close();
  await page.bringToFront();
  await cdp.send("Emulation.setFocusEmulationEnabled", { enabled: true });
  await cdp.detach();
  await page.mouse.move(0, 0);
  await page.clock.fastForward(5001);
  await expect(page.getByText("Piece added.", { exact: true })).toHaveCount(0);
});

test("errors and Undo remain accessible in the top modal and survive back and close", async ({ page }) => {
  await page.goto("/?scenario=notifications");
  await page.clock.install();
  await page.getByRole("button", { name: "Error notice", exact: true }).click();
  await page.getByRole("button", { name: "Undo notice", exact: true }).click();
  await page.getByRole("button", { name: "Open task", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Open nested dialog", exact: true }).click();
  const nested = page.getByRole("dialog", { name: "Synthetic confirmation", exact: true });
  await expect(nested.getByRole("alert")).toContainText("Could not save");
  await expect(nested.getByRole("button", { name: "Undo", exact: true })).toBeVisible();
  await page.clock.fastForward(60_000);
  await expect(nested.getByRole("button", { name: "Undo", exact: true })).toBeVisible();
  await page.keyboard.press("F8");
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press("Tab");
    expect(await nested.evaluate(el => el.contains(document.activeElement))).toBe(true);
  }
  await nested.getByRole("button", { name: "Back to task", exact: true }).click();
  const task = page.getByRole("dialog", { name: "Synthetic task", exact: true });
  await expect(task.getByRole("button", { name: "Undo", exact: true })).toBeVisible();
  await task.getByRole("button", { name: "Back to wardrobe", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.getByText("Removal undone.", { exact: true })).toBeVisible();
  await expect(page.getByText("Piece removed.", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Dismiss notification", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveCount(0);
});


test("capture cancellation, upload error and retry preserve the saved result after reload", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?scenario=wardrobe&scope=single_piece");
  await page.getByRole("button", { name: "Add outfit", exact: true }).click();
  await page.getByRole("button", { name: "Close camera", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  let state = await page.request.get("/__fixture/state").then(response => response.json());
  expect(state.calls).toHaveLength(0);
  await page.route("**/__fixture/upload", route => route.fulfill({ status: 503, body: "Synthetic upload failure" }), { times: 1 });
  await choosePhoto(page);
  await expect(page.getByRole("alert")).toContainText("Photo storage is unavailable");
  await page.getByRole("button", { name: "Open Overshirt details", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText("Photo storage is unavailable");
  await page.getByRole("dialog").getByRole("button", { name: "Done", exact: true }).click();
  await addPiece(page);
  // Starting another capture must not silently clear the previous error.
  await expect(page.getByRole("alert")).toContainText("Photo storage is unavailable");
  await page.reload();
  await expect(page.getByRole("button", { name: "Open Synthetic added piece details", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Dismiss notification", exact: true })).toHaveCount(0);
  state = await page.request.get("/__fixture/state").then(response => response.json());
  expect(state.calls.filter((call: { operation: string }) => call.operation === "create-piece")).toHaveLength(1);
});
