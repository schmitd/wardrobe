import { test, expect } from "playwright/test";

test("stale planner loads cannot undo the visible result of a newer saved mutation", async ({ page }) => {
  let loads = 0;
  let release: (() => void) | undefined;
  let captured: (() => void) | undefined;
  const staleReady = new Promise<void>(resolve => { captured = resolve; });
  const allowStale = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/planning", async route => {
    if (route.request().postDataJSON().operation === "planning_load" && ++loads === 2) {
      const response = await route.fetch();
      const json = await response.json();
      captured!();
      await allowStale;
      await route.fulfill({ json });
    } else await route.continue();
  });
  await page.goto("/?scenario=planner");
  await staleReady;
  await page.getByRole("button", { name: "I wore this", exact: true }).click();
  await expect(page.getByText("Recorded as worn.", { exact: true })).toBeVisible();
  const staleResponse = page.waitForResponse(response => response.url().endsWith("/api/planning") && response.request().postDataJSON().operation === "planning_load");
  release!();
  await staleResponse;
  // Let React commit the delayed older load before testing the state.
  await page.waitForTimeout(100);
  await expect(page.getByText("Recorded as worn.", { exact: true })).toBeVisible();
});
