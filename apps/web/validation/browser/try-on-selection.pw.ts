import { test, expect } from "playwright/test";
import { cameraFixture } from "./camera-fixture";
const photo = {
  name: "synthetic.png",
  mimeType: "image/png",
  buffer: Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==",
    "base64",
  ),
};
test("actual Try-on uses inline named collection choices after truthful loading and saves the chosen collection", async ({
  page,
}) => {
  await cameraFixture(page);
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  await page.route("**/__fixture/query", async (route) => {
    if (route.request().postDataJSON().query === "wardrobes.listWardrobes")
      await gate;
    await route.continue();
  });
  await page.goto("/?scenario=wardrobe");
  await page.getByRole("button", { name: "Add outfit", exact: true }).click();
  await page.getByRole("button", { name: "Try on", exact: true }).click();
  const chooser = page.waitForEvent("filechooser");
  await page
    .getByRole("button", { name: "Choose photos", exact: true })
    .click();
  await (await chooser).setFiles(photo);
  const dialog = page.getByRole("dialog", {
    name: "Try on outfit",
    exact: true,
  });
  await expect(
    dialog.getByText("Loading collections…", { exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByText("Create a collection before saving inspiration.", {
      exact: true,
    }),
  ).toHaveCount(0);
  release();
  await dialog.getByRole("button", { name: "Weekend", exact: true }).click();
  await expect(
    dialog.getByRole("button", { name: "Weekend", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(dialog.getByRole("combobox")).toHaveCount(0);
  await dialog
    .getByRole("button", { name: "Save to collection", exact: true })
    .click();
  await expect(
    dialog.getByText("Saved to Weekend as inspiration.", { exact: true }),
  ).toBeVisible();
  const state = await page.request
    .get("/__fixture/state")
    .then((r) => r.json());
  expect(
    state.calls.filter(
      (c: { operation: string }) => c.operation === "save-inspiration",
    ),
  ).toHaveLength(1);
  expect(
    state.calls.find(
      (c: { operation: string }) => c.operation === "save-inspiration",
    ).input.wardrobeId,
  ).toBe("weekend");
});
