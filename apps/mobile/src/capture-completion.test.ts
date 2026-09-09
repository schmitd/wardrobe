import { expect, test } from "bun:test";
import { captureCompletionDestination } from "./capture-completion";

test("saved pieces return straight to the wardrobe", () => {
  expect(captureCompletionDestination("piece")).toBe("/(tabs)/wardrobe");
});
test("recorded fits return straight to Fits", () => {
  expect(captureCompletionDestination("fit")).toBe("/(tabs)/fits");
});
test("try-on keeps its meaningful feedback screen", () => {
  expect(captureCompletionDestination("try_on")).toBeNull();
});
