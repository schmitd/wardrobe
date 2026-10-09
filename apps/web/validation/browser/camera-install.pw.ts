import { test, expect } from "playwright/test";
import sharp from "sharp";
import { cameraFixture } from "./camera-fixture";

const photo = { name: "synthetic.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==", "base64") };
const add = (page: import("playwright/test").Page) => page.getByRole("button", { name: "Add outfit", exact: true });

test("actual Add captures the complete frame, saves once and releases camera in portrait and landscape", async ({ page }) => {
  await cameraFixture(page);
  for (const size of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(size); await page.goto(`/?scenario=wardrobe&case=crop-${size.width}`);
    await add(page).click();
    const camera = page.getByRole("dialog", { name: "Camera", exact: true });
    await expect(camera).toBeVisible();
    await expect(page.getByRole("button", { name: "Take photo" })).toBeEnabled();
    expect(await camera.boundingBox()).toEqual({ x: 0, y: 0, ...size });
    for (const name of ["Close camera", "Take photo", "Choose photos"]) {
      const bounds = await page.getByRole("button", { name, exact: true }).boundingBox();
      expect(bounds!.x).toBeGreaterThanOrEqual(0); expect(bounds!.y).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(size.width);
      expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(size.height);
    }
    await page.screenshot({ path: `../../output/playwright/camera-${size.width}.png` });
    const upload = page.waitForRequest(request => request.method() === "POST" && request.url().endsWith("/__fixture/upload"));
    await page.getByRole("button", { name: "Take photo" }).click();
    await upload;
    await expect.poll(async () => (await page.request.get("/__fixture/state").then(r => r.json())).uploadImages.length).toBe(1);
    const image = (await page.request.get("/__fixture/state").then(r => r.json())).uploadImages[0];
    expect(image.width! / image.height!).toBeCloseTo(640 / 480, 2);
    await expect(camera).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => window.cameraProbe.active)).toBe(0);
    await expect(page.getByText("Outfit saved.", { exact: true })).toBeVisible();
    const state = await page.request.get("/__fixture/state").then(r => r.json());
    expect(state.calls.filter((call: { operation: string }) => call.operation === "daily-fit")).toHaveLength(1);
    const constraints = await page.evaluate(() => window.cameraProbe.constraints[0]);
    expect(constraints.audio).toBe(false); expect(constraints.video).toMatchObject({ facingMode: { ideal: "environment" } });
  }
});

test("pending permission can close or choose library; late result stops before reopen request", async ({ page }) => {
  await cameraFixture(page, "pending"); await page.goto("/?scenario=wardrobe");
  await add(page).click(); await expect.poll(() => page.evaluate(() => window.cameraProbe.requests)).toBe(1);
  await expect(page.getByRole("button", { name: "Take photo" })).toBeDisabled();
  await page.getByRole("button", { name: "Close camera" }).click(); await expect(add(page)).toBeFocused();
  await add(page).click();
  expect(await page.evaluate(() => window.cameraProbe.requests)).toBe(1);
  await page.evaluate(() => window.cameraProbe.resolve());
  await expect.poll(() => page.evaluate(() => window.cameraProbe.requests)).toBe(2);
  expect(await page.evaluate(() => window.cameraProbe.stops)).toBe(1);
  await page.evaluate(() => window.cameraProbe.resolve());
  await expect(page.getByRole("button", { name: "Take photo" })).toBeEnabled();
  const chooser = page.waitForEvent("filechooser"); await page.getByRole("button", { name: "Choose photos", exact: true }).click();
  await (await chooser).setFiles([]);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(await page.evaluate(() => ({ active: window.cameraProbe.active, maximum: window.cameraProbe.maximum }))).toEqual({ active: 0, maximum: 1 });
});

for (const mode of ["deny", "busy"] as const) test(`${mode}: concise fallback, cancel, retry same photo and dismiss completion`, async ({ page }) => {
  await cameraFixture(page, mode); await page.goto("/?scenario=wardrobe");
  for (const files of [[], [photo], [photo]]) {
    await add(page).click(); await expect(page.getByRole("alert")).toContainText("Camera unavailable");
    await expect(page.getByRole("button", { name: "Take photo" })).toHaveCount(0);
    const chooser = page.waitForEvent("filechooser"); await page.getByRole("button", { name: "Choose photo", exact: true }).click();
    const picker = await chooser; expect(picker.isMultiple()).toBe(true);
    expect(await picker.element().getAttribute("capture")).toBeNull();
    await picker.setFiles(files); await expect(page.getByRole("dialog")).toHaveCount(0);
    if (files.length) { await expect(page.getByText("Outfit saved.", { exact: true })).toBeVisible(); await page.getByRole("button", { name: "Dismiss notification" }).click(); }
    await expect(add(page)).toBeEnabled();
  }
  const state = await page.request.get("/__fixture/state").then(r => r.json());
  expect(state.calls.filter((call: { operation: string }) => call.operation === "daily-fit")).toHaveLength(2);
});

test("absent getUserMedia opens the native picker in the original Add click", async ({ page }) => {
  await cameraFixture(page, "missing"); await page.goto("/?scenario=wardrobe");
  const chooser = page.waitForEvent("filechooser"); await add(page).click();
  const picker = await chooser; expect(picker.isMultiple()).toBe(true);
  await expect(page.getByRole("dialog")).toHaveCount(0); await picker.setFiles([]);
  expect(await page.evaluate(() => window.cameraProbe.requests)).toBe(0);
});

test("background and history navigation release the active stream", async ({ page }) => {
  await cameraFixture(page); await page.goto("/?scenario=wardrobe");
  await add(page).click(); await expect(page.getByRole("button", { name: "Take photo" })).toBeEnabled();
  const preview = await page.getByLabel("Camera preview").elementHandle();
  await page.evaluate(() => { Object.defineProperty(document, "hidden", { configurable: true, value: true }); document.dispatchEvent(new Event("visibilitychange")); });
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(await preview!.evaluate(video => (video as HTMLVideoElement).srcObject)).toBeNull();
  expect(await page.evaluate(() => window.cameraProbe.active)).toBe(0);
  await page.evaluate(() => { Object.defineProperty(document, "hidden", { configurable: true, value: false }); history.pushState({}, "", location.href); });
  await add(page).click(); await expect(page.getByRole("button", { name: "Take photo" })).toBeEnabled();
  await page.goBack(); await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(await page.evaluate(() => window.cameraProbe.active)).toBe(0);
});

test("install action requires a usable event, calls it once in click and clears after use or installation", async ({ page }) => {
  await page.goto("/?scenario=wardrobe"); await expect(add(page)).toBeVisible();
  const install = page.getByRole("button", { name: "Install Lint", exact: true });
  await expect(install).toHaveCount(0);
  const send = () => page.evaluate(() => {
    const state = { calls: 0, active: false };
    const event = Object.assign(new Event("beforeinstallprompt", { cancelable: true }), {
      prompt: () => { state.calls++; state.active = navigator.userActivation.isActive; return Promise.resolve(); },
      userChoice: Promise.resolve({ outcome: "dismissed" }),
    });
    (window as unknown as { installProbe: typeof state }).installProbe = state;
    window.dispatchEvent(event); return event.defaultPrevented;
  });
  expect(await send()).toBe(true); await expect(install).toBeVisible(); await install.click();
  await expect(install).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { installProbe: unknown }).installProbe)).toEqual({ calls: 1, active: true });
  await send(); await expect(install).toBeVisible(); await page.evaluate(() => window.dispatchEvent(new Event("appinstalled")));
  await expect(install).toHaveCount(0);
  await page.evaluate(() => Object.defineProperty(navigator, "standalone", { configurable: true, value: true }));
  expect(await send()).toBe(false); await expect(install).toHaveCount(0);
});

test("manifest keeps stable Lint identity and real square install icons", async ({ request }) => {
  const manifest = await request.get("/manifest.webmanifest").then(r => r.json());
  expect(manifest).toMatchObject({ id: "/", name: "Lint", short_name: "Lint", start_url: "/", scope: "/", display: "standalone", prefer_related_applications: false });
  for (const icon of manifest.icons) {
    const response = await request.get(icon.src);
    const bytes = await response.body();
    const image = await sharp(bytes).metadata();
    expect(`${image.width}x${image.height}`).toBe(icon.sizes); expect(image.format).toBe("png");
  }
});
