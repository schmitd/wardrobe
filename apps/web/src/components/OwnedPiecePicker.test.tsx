import { afterEach, expect, mock, test } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import React from "react";

GlobalRegistrator.register();
const { render, screen, fireEvent, cleanup } = await import("@testing-library/react");
// The actual picker and sanitizer run unchanged; no component lookalikes.
const { default: OwnedPiecePicker } = await import("./OwnedPiecePicker");
afterEach(cleanup);
const items = [
  { id: "piece_1", category: "Shirt", description: "Blue cotton (piece_1)" },
  { id: "piece_2", category: "Boots", description: "Leather piece_2" },
];
test("inline picker searches and chooses by transport ID without rendering it", () => {
  const choose = mock(() => {});
  render(<OwnedPiecePicker items={items} disabled={false} onChoose={choose} />);
  expect(screen.queryByRole("combobox")).toBeNull();
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(document.body.textContent).not.toContain("piece_1");
  expect(document.body.textContent).not.toContain("piece_2");
  fireEvent.change(screen.getByRole("searchbox", { name: "Find a piece" }), { target: { value: "cotton" } });
  expect(screen.queryByRole("button", { name: /Boots/ })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: /Shirt Blue cotton/ }));
  expect(choose).toHaveBeenCalledWith("piece_1");
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "no match" } });
  expect(screen.getByRole("status").textContent).toBe("No matching pieces.");
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "" } });
  expect(screen.getAllByRole("button")).toHaveLength(2);
});
test("pending choices cannot invoke a mutation and become usable when settled", () => {
  const choose = mock(() => {});
  const view = render(<OwnedPiecePicker items={items} disabled onChoose={choose} />);
  fireEvent.click(screen.getByRole("button", { name: /Boots/ }));
  expect(choose).not.toHaveBeenCalled();
  view.rerender(<OwnedPiecePicker items={items} disabled={false} onChoose={choose} />);
  fireEvent.click(screen.getByRole("button", { name: /Boots/ }));
  expect(choose).toHaveBeenCalledTimes(1);
  expect(choose).toHaveBeenCalledWith("piece_2");
});
test("legacy generated prose drops removed transport references while retaining garment detail", () => {
  render(<OwnedPiecePicker items={[{
    id: "current-piece", category: "Coat",
    description: `Wool coat 123e4567-e89b-12d3-a456-426614174000 ${"a1".repeat(16)} piece_42, size 42.`,
  }]} disabled={false} onChoose={() => {}} />);
  expect(screen.getByRole("button", { name: /Coat Wool coat, size 42\./ })).toBeTruthy();
  expect(document.body.textContent).not.toContain("123e4567");
  expect(document.body.textContent).not.toContain("a1a1");
  expect(document.body.textContent).not.toContain("piece_42");
});
