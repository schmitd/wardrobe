import { afterEach, expect, test } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import React from "react";
GlobalRegistrator.register();
const { render, screen, fireEvent, cleanup } = await import("@testing-library/react");
const { default: AuthEntry } = await import("./AuthEntry");
afterEach(cleanup);
test("session loading does not mount guest capture; explicit guest escape survives stalled auth", () => {
  render(<AuthEntry ready={false}><div>Guest capture</div></AuthEntry>);
  expect(screen.queryByText("Guest capture")).toBeNull();
  expect(screen.getByRole("link", { name: "Sign in" }).getAttribute("href")).toBe("/sign-in");
  fireEvent.click(screen.getByRole("button", { name: "Continue as guest" }));
  expect(screen.getByText("Guest capture")).toBeTruthy();
});
test("restored session replaces the guest surface and preserves the guest draft", () => {
  sessionStorage.setItem("wardrobe.guestSnapshot.v1", "preserved guest draft");
  const view = render(<AuthEntry ready={false}><div>Guest capture</div></AuthEntry>);
  fireEvent.click(screen.getByRole("button", { name: "Continue as guest" }));
  view.rerender(<AuthEntry ready={true}><div>Signed-in wardrobe</div></AuthEntry>);
  expect(screen.queryByText("Guest capture")).toBeNull();
  expect(screen.getByText("Signed-in wardrobe")).toBeTruthy();
  expect(sessionStorage.getItem("wardrobe.guestSnapshot.v1")).toBe("preserved guest draft");
});
