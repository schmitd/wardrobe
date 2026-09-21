import { expect, test } from "bun:test";
import { recallCollections } from "./collection-context";
const collections = [
  { id: "work", name: "Work edit", description: "Relaxed tailoring" },
  { id: "trail", name: "Trail days" },
  { id: "dinner", name: "Dinner out" },
];
test("recalls a collection from related calendar activity without manual selection", () => {
  expect(
    recallCollections(collections, "Client presentation at 10").map(
      (c) => c.id,
    ),
  ).toEqual(["work"]);
  expect(
    recallCollections(collections, "Hiking on Sunday").map((c) => c.id),
  ).toEqual(["trail"]);
});
test("does not force irrelevant collections and bounds fan-out", () => {
  expect(recallCollections(collections, "Today I want an outfit")).toEqual([]);
  expect(recallCollections(collections, "")).toEqual([]);
  expect(
    recallCollections(
      Array.from({ length: 120 }, (_, i) => ({ id: String(i), name: "Work" })),
      "meeting",
    ),
  ).toHaveLength(3);
});
