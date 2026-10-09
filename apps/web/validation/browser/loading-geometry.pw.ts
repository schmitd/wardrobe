import { test, expect, type Page } from "playwright/test";
const points = [
  ".collection-rail",
  ".collection-heading",
  ".rack-piece-photo",
  ".rack-piece-stage",
  ".rack-piece-caption",
  '[aria-label="Fits views"]',
  ".planner-day-rail",
  ".planner-outfit-photo",
  ".planner-outfit-title",
  ".planner-action-row",
  '[aria-label="Daily fit calendar"]',
  "[data-fit-card]",
];
async function boxes(page: Page) {
  return page.evaluate(
    (sels) =>
      Object.fromEntries(
        sels.map((s) => {
          const b = document.querySelector(s)?.getBoundingClientRect();
          return [
            s,
            b ? { x: b.x, y: b.y, width: b.width, height: b.height } : null,
          ];
        }),
      ),
    points,
  );
}
for (const width of [320, 390, 430])
  for (const area of ["wardrobe", "plan", "diary"])
    test(`loading geometry ${area} ${width}: delayed queries and images preserve shared boxes`, async ({
      page,
    }, info) => {
      await page.setViewportSize({ width, height: 844 });
      await page.addInitScript(() => {
        (window as unknown as { shifts: number[] }).shifts = [];
        new PerformanceObserver((list) =>
          list.getEntries().forEach((entry) => {
            const e = entry as PerformanceEntry & {
              hadRecentInput: boolean;
              value: number;
            };
            if (!e.hadRecentInput)
              (window as unknown as { shifts: number[] }).shifts.push(e.value);
          }),
        ).observe({ type: "layout-shift", buffered: true });
      });
      let release!: () => void;
      const gate = new Promise<void>((r) => (release = r));
      let releaseImages!: () => void;
      const images = new Promise<void>((r) => (releaseImages = r));
      await page.route("**/__fixture/query", async (route) => {
        await gate;
        await route.continue();
      });
      await page.route("**/api/planning", async (route) => {
        await gate;
        await route.continue();
      });
      await page.route("**/piece-*.svg", async (route) => {
        await images;
        await route.continue();
      });
      await page.goto(
        area === "wardrobe"
          ? "/?scenario=home-import"
          : `/fits/${area}?scenario=fits`,
      );
      await page
        .locator(
          area === "wardrobe"
            ? ".rack-piece-stage"
            : area === "plan"
              ? ".planner-outfit-photo"
              : '[aria-label="Daily fit calendar"]',
        )
        .first()
        .waitFor();
      if (area === "wardrobe") {
        await expect(
          page.locator(".rack-piece-photo .loading-image-region"),
        ).toHaveCount(0);
        await expect(page.locator(".rack-piece-photo img")).toHaveCount(0);
        expect(await page.locator(".rack-piece-photo").first().evaluate(node => ({children:node.childElementCount, background:getComputedStyle(node).backgroundColor}))).toEqual({children:0, background:"rgba(0, 0, 0, 0)"});
        expect(await page.locator(".rack-piece-caption .loading-text-line").count()).toBeGreaterThan(0);
      }
      const pending = await boxes(page);
      await page.screenshot({
        path: info.outputPath("pending.png"),
        fullPage: true,
      });
      expect(
        await page.getByText("Retry loading outfits", { exact: true }).count(),
      ).toBe(0);
      if (area === "diary")
        expect(
          await page.locator('[aria-label$="no fit recorded"]').count(),
        ).toBe(0);
      release();
      await page
        .locator(
          area === "wardrobe"
            ? "[data-wardrobe-item-id]"
            : area === "plan"
              ? ".planner-outfit-photo img"
              : "#fit-synthetic-fit",
        )
        .first()
        .waitFor();
      const resolved = await boxes(page);
      const required =
        area === "wardrobe"
          ? [
              ".collection-rail",
              ".collection-heading",
              ".rack-piece-photo",
              ".rack-piece-stage",
              ".rack-piece-caption",
            ]
          : area === "plan"
            ? [
                '[aria-label="Fits views"]',
                ".planner-day-rail",
                ".planner-outfit-photo",
                ".planner-outfit-title",
                ".planner-action-row",
              ]
            : [
                '[aria-label="Fits views"]',
                '[aria-label="Daily fit calendar"]',
                "[data-fit-card]",
              ];
      for (const selector of required) {
        expect(pending[selector], `pending ${selector}`).not.toBeNull();
        expect(resolved[selector], `resolved ${selector}`).not.toBeNull();
      }

      releaseImages();
      await page.waitForFunction(() =>
        Array.from(document.images).every((image) => image.complete),
      );
      await page.evaluate(
        () =>
          new Promise<void>((r) =>
            requestAnimationFrame(() => requestAnimationFrame(() => r())),
          ),
      );
      const decoded = await boxes(page);
      for (const [selector, before] of Object.entries(pending)) {
        const after = resolved[selector];
        if (before && after)
          for (const key of ["x", "y", "width", "height"] as const)
            expect(
              Math.abs(before[key] - after[key]),
              `${selector}.${key}`,
            ).toBeLessThan(1);
      }
      expect(decoded).toEqual(resolved);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth - innerWidth,
        ),
      ).toBe(0);
      const cls = await page.evaluate(() =>
        (window as unknown as { shifts: number[] }).shifts.reduce(
          (a, b) => a + b,
          0,
        ),
      );
      expect(cls).toBeLessThan(0.01);
      await info.attach("geometry", {
        body: JSON.stringify({
          width,
          area,
          pending,
          resolved,
          decoded,
          cls,
          noRecentInput: true,
        }),
        contentType: "application/json",
      });
      await page.screenshot({
        path: info.outputPath("settled.png"),
        fullPage: true,
      });
    });
test("cold Diary lazy module uses the same calendar and recent-card geometry", async ({
  page,
}) => {
  const chunks = (await page.request
    .get("/__fixture/chunks")
    .then((r) => r.json())) as { path: string; diary: boolean }[];
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  expect(chunks.filter((c) => c.diary).length).toBeGreaterThan(0);
  for (const chunk of chunks.filter((c) => c.diary))
    await page.route(`**${chunk.path}`, async (route) => {
      await gate;
      await route.continue();
    });
  await page.goto("/fits/diary?scenario=fits");
  await page
    .getByRole("heading", { name: "Outfit diary", exact: true })
    .waitFor();
  const pending = await boxes(page);
  expect(pending['[aria-label="Daily fit calendar"]']).not.toBeNull();
  expect(pending["[data-fit-card]"]).not.toBeNull();
  release();
  await page.locator("#fit-synthetic-fit").waitFor();
  const settled = await boxes(page);
  for (const s of ['[aria-label="Daily fit calendar"]', "[data-fit-card]"])
    expect(settled[s]).toEqual(pending[s]);
});
test("nested Plan and Diary restore owner drafts; history starts only in Diary and pending clears private content", async ({
  page,
}) => {
  const queries: string[] = [];
  page.on("request", (request) => {
    if (request.url().endsWith("/__fixture/query"))
      queries.push(request.postDataJSON().query);
  });
  await page.goto("/fits/plan?scenario=fits");
  await page
    .getByText("Easy structure for your day", { exact: true })
    .waitFor();
  expect(queries).not.toContain("fitChecks.pageFitChecks");
  const selectedDay = await page.locator(".planner-day").nth(1).getAttribute("aria-label");
  await page.locator(".planner-day").nth(1).click();
  await page.getByRole("button", { name: "Describe your day or week" }).click();
  await page
    .getByRole("textbox", { name: "Describe your day or week" })
    .fill("Owner A unfinished plans");
  await page.keyboard.press("Escape");
  await page.getByRole("link", { name: "Diary", exact: true }).click();
  await expect(page).toHaveURL(/\/fits\/diary/);
  await page.locator("#fit-synthetic-fit").waitFor();
  await page.getByRole("link", { name: "Plan", exact: true }).click();
  await expect(page.locator(".planner-day").nth(1)).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".planner-day").nth(1)).toHaveAttribute("aria-label", selectedDay!);
  await page.getByRole("button", { name: "Describe your day or week" }).click();
  await expect(
    page.getByRole("textbox", { name: "Describe your day or week" }),
  ).toHaveValue("Owner A unfinished plans");
  await page.keyboard.press("Escape");
  await page.goBack();
  await expect(page).toHaveURL(/\/fits\/diary/);
  await page.locator("#fit-synthetic-fit").waitFor();
  await page.goForward();
  await expect(page).toHaveURL(/\/fits\/plan/);
  await expect(page.locator(".planner-day").nth(1)).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("link", { name: "Diary", exact: true }).click();
  await page.locator("#fit-synthetic-fit").waitFor();
  await page.evaluate(() => {
    window.fixtureAuth = {
      isLoaded: true,
      isSignedIn: true,
      userId: "synthetic-alice",
      backendPending: true,
    };
    window.dispatchEvent(new Event("fixture-auth"));
  });
  await expect(page.locator("#fit-synthetic-fit")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Outfit diary", exact: true }),
  ).toBeVisible();
  await page.evaluate(() => {
    window.fixtureAuth = {
      isLoaded: true,
      isSignedIn: true,
      userId: "synthetic-bob",
    };
    window.dispatchEvent(new Event("fixture-auth"));
  });
  await page.getByRole("link", { name: "Plan", exact: true }).click();
  await page.getByRole("button", { name: "Describe your day or week" }).click();
  await expect(
    page.getByRole("textbox", { name: "Describe your day or week" }),
  ).toHaveValue("");
});
test("Diary empty and query failure recover truthfully; Plan failure actually retries", async ({
  page,
}) => {
  await page.goto("/fits/diary?scenario=fits&case=diary-empty");
  await expect(
    page.getByText("No fits recorded yet.", { exact: true }),
  ).toBeVisible();
  await expect(page.locator('[aria-label$="no fit recorded"]')).toHaveCount(84);
  await page.goto("/fits/diary?scenario=fits&case=diary-error");
  await expect(page.getByRole("alert")).toContainText("could not load");
  await page.getByRole("button", { name: "Retry fits", exact: true }).click();
  await expect(page.locator("#fit-synthetic-fit")).toBeVisible();
  await page.goto("/fits/plan?scenario=fits&case=plan-error");
  await page
    .getByRole("button", { name: "Retry loading outfits", exact: true })
    .click();
  await expect(
    page.getByText("Easy structure for your day", { exact: true }),
  ).toBeVisible();
});

test("partial Diary history stays unknown until bounded history is exhausted", async ({
  page,
}) => {
  await page.goto("/fits/diary?scenario=fits&case=diary-partial");
  await page.locator("#fit-synthetic-fit").waitFor();
  await expect(page.locator('[aria-label$="no fit recorded"]')).toHaveCount(0);
  await expect(page.locator('[aria-label$="history not loaded"]')).toHaveCount(
    83,
  );
  await page
    .getByRole("button", { name: "Load earlier fits", exact: true })
    .click();
  await expect(page.locator('[aria-label$="no fit recorded"]')).toHaveCount(83);
});
for (const reducedMotion of ["no-preference", "reduce"] as const)
  test(`Diary image reveal honors ${reducedMotion} without container animation`, async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion });
    await page.addInitScript(() => {
      const animate = Element.prototype.animate;
      Object.assign(window, { reveals: [] });
      Element.prototype.animate = function (frames, options) {
        (
          window as unknown as { reveals: { tag: string; duration: unknown }[] }
        ).reveals.push({
          tag: this.tagName,
          duration: typeof options === "number" ? options : options?.duration,
        });
        return animate.call(this, frames, options);
      };
    });
    await page.goto("/fits/diary?scenario=fits");
    await page.locator("#fit-synthetic-fit img").waitFor();
    await page.waitForFunction(() =>
      Array.from(document.images).every((i) => i.complete),
    );
    const reveals = await page.evaluate(
      () =>
        (window as unknown as { reveals: { tag: string; duration: unknown }[] })
          .reveals,
    );
    expect(reveals.every((r) => r.tag === "IMG" && r.duration === 160)).toBe(
      true,
    );
    if (reducedMotion === "reduce") expect(reveals).toEqual([]);
    else expect(reveals.length).toBeGreaterThan(0);
  });
test("saved outfit history placeholder matches a real planned card without wrapping photo rows", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  await page.route("**/__fixture/query", async (route) => {
    if (route.request().postDataJSON().query === "planning.load") await gate;
    await route.continue();
  });
  await page.goto("/fits/diary?scenario=fits&case=history-geometry");
  const card = page.locator("[data-history-card]").first();
  await card.waitFor();
  const pending = await card.boundingBox();
  await expect(card.locator(".loading-image-region")).toHaveCount(0);
  expect(await card.locator(".my-3").evaluate(node => ({children:node.childElementCount, height:node.getBoundingClientRect().height, background:getComputedStyle(node).backgroundColor}))).toEqual({children:0,height:84,background:"rgba(0, 0, 0, 0)"});
  release();
  await page
    .getByText("Easy structure for your day", { exact: true })
    .waitFor();
  expect(await card.boundingBox()).toEqual(pending);
});
