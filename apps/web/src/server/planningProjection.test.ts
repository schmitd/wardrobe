import { expect, test } from "bun:test";
import { projectPlanningItems } from "./planningProjection";

test("client planning items omit private model-only notes", () => {
  expect(
    projectPlanningItems([
      {
        id: "item-1",
        description: "Navy overshirt",
        category: "Shirt",
        imageUrl: "https://example.test/item",
        note: "Private fit note",
      },
    ]),
  ).toEqual([
    {
      id: "item-1",
      description: "Navy overshirt",
      category: "Shirt",
      imageUrl: "https://example.test/item",
    },
  ]);
});
