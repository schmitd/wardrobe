import { test, expect } from "playwright/test";

test("planner calendar and options stay fully inside the viewport with production CSS", async ({ page }) => {
  for (const width of [390, 576, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/?scenario=planner");
    for (const name of ["Calendar", "Planner options"]) {
      await page.getByRole("button", { name, exact: true }).click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      await expect.poll(async () => {
        const box = await dialog.boundingBox();
        return box && box.x >= 0 && box.y >= 0 && box.x + box.width <= width + 1 && box.y + box.height <= 845;
      }).toBe(true);
      await expect(dialog.getByRole("button", { name: "Close", exact: true })).toBeInViewport();
      const box = (await dialog.boundingBox())!;
      expect(box.width).toBe(width < 640 ? width : 440);
      await dialog.getByRole("button", { name: "Close", exact: true }).click();
      await expect(dialog).toHaveCount(0);
      await expect(page.getByRole("button", { name, exact: true })).toBeFocused();
    }
  }
});
