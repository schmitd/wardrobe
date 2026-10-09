import { test, expect } from "playwright/test";

// Chromium mobile viewport and synthetic auth only; not physical Android/iOS.
test.use({ viewport: { width: 390, height: 844 } });
test("guest: auth loading can be escaped, capture is optional, and sign-in is visible", async ({ page }) => {
  await page.clock.install();
  await page.goto("/?scenario=guest&authPending=1");
  await expect(page.locator("[data-home-shell]")).toBeVisible();
  await expect(page.getByRole("button", {name:"Continue as guest"})).toHaveCount(0);
  await page.clock.runFor(8100);
  await expect(page.getByRole("button", { name: "Take photo" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/sign-in");
  await page.getByRole("button", { name: "Continue as guest" }).click();
  await expect(page.getByRole("button", { name: "Take photo" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Choose photo" })).toBeVisible();
  await expect(page.getByRole("region", {name:"Guest mode"}).getByRole("link", {name:"Sign in"})).toBeVisible();
  await expect(page.getByLabel("Take outfit photo")).toHaveAttribute("capture", "environment");
  await expect(page.getByLabel("Choose outfit photo")).not.toHaveAttribute("capture");
  await page.getByLabel("Choose outfit photo").dispatchEvent("change");
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page.screenshot({ path: "../../output/playwright/guest-entry-mobile.png", fullPage: true });
});
