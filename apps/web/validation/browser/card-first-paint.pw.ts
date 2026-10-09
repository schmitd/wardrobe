import { test, expect } from "playwright/test";

// Real RackItemCard/production CSS; synthetic image/data boundaries, desktop Chrome.
test.use({ viewport: { width: 390, height: 844 } });
for (const reducedMotion of ["no-preference", "reduce"] as const) {
  test(`rack: stable shell before/after slow images (${reducedMotion})`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion });
    await page.addInitScript(() => {
      const original = Element.prototype.animate;
      const reveals: { tag: string; duration: unknown }[] = [];
      Object.assign(window, { __cardReveals: reveals });
      Element.prototype.animate = function (frames, options) {
        reveals.push({ tag: this.tagName, duration: typeof options === "number" ? options : options?.duration });
        return original.call(this, frames, options);
      };
    });
    await page.route("**/__fixture/piece-*.svg", async route => {
      await new Promise(resolve => setTimeout(resolve, 400));
      await route.continue();
    });
    await page.goto("/?scenario=wardrobe", { waitUntil: "domcontentloaded" });
    const card = page.locator(".rack-piece").first();
    await expect(card).toBeVisible();
    const box = await card.boundingBox();
    const accent = await card.evaluate(element => getComputedStyle(element).getPropertyValue("--rack-item-accent"));
    await expect.poll(() => card.locator("img").evaluate(image => (image as HTMLImageElement).complete)).toBe(true);
    await expect.poll(() => card.boundingBox()).toEqual(box);
    expect(await card.evaluate(element => getComputedStyle(element).getPropertyValue("--rack-item-accent"))).toBe(accent);
    expect(accent).toMatch(/^rgb\(\d+ \d+ \d+\)$/);
    const reveals = await page.evaluate(() => (window as unknown as { __cardReveals: {tag: string; duration: unknown}[] }).__cardReveals.filter(event => event.tag === "IMG"));
    if (reducedMotion === "reduce") expect(reveals).toHaveLength(0);
    else expect(reveals.some(event => event.duration === 160)).toBe(true);
  });
}

for (const reducedMotion of ["no-preference", "reduce"] as const) test(`Fits collage image-only reveal (${reducedMotion})`, async ({page}) => {
  await page.emulateMedia({reducedMotion});
  await page.addInitScript(() => {
    const original = Element.prototype.animate;
    Object.assign(window,{fixtureReveals:[]});
    Element.prototype.animate = function(frames,options) {
      (window as unknown as {fixtureReveals:{tag:string,duration:unknown}[]}).fixtureReveals.push({tag:this.tagName,duration:typeof options === "number" ? options : options?.duration});
      return original.call(this,frames,options);
    };
  });
  await page.goto("/?scenario=fits");
  const collage = page.locator(".planner-outfit-photo").first();
  await expect(collage).toBeVisible();
  const box = await collage.boundingBox();
  await expect.poll(() => collage.locator("img").evaluateAll(images => images.every(image => (image as HTMLImageElement).complete))).toBe(true);
  expect(await collage.boundingBox()).toEqual(box);
  const reveals = await page.evaluate(() => (window as unknown as {fixtureReveals:{tag:string,duration:unknown}[]}).fixtureReveals.filter(r=>r.tag === "IMG"));
  if (reducedMotion === "reduce") expect(reveals).toHaveLength(0);
  else expect(reveals.some(r=>r.duration === 160)).toBe(true);
});
