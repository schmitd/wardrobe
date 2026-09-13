import { expect, test } from "bun:test";
import { limitedJson } from "./limitedJson";
test("bounds actual bytes even without a Content-Length header", async () => {
  const request = (value: unknown) =>
    new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify(value),
    });
  expect(
    await limitedJson(request({ operation: "planning_load" }), 100),
  ).toEqual({ operation: "planning_load" });
  await expect(
    limitedJson(request({ text: "👕".repeat(100) }), 200),
  ).rejects.toThrow("Request too large");
  await expect(
    limitedJson(
      new Request("http://localhost", { method: "POST", body: "broken" }),
      100,
    ),
  ).rejects.toThrow();
});
