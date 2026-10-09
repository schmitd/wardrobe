import { afterEach, expect, test } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import React from "react";
GlobalRegistrator.register();
const { render, screen, fireEvent, cleanup } = await import("@testing-library/react");
const { default: AuthEntry } = await import("./AuthEntry");
const {GuestChoiceProvider}=await import("./GuestChoice");
afterEach(cleanup);
test("initial pending shell is useful without premature recovery or private content", () => {
  render(<GuestChoiceProvider><AuthEntry ready={false}><div>Private wardrobe</div></AuthEntry></GuestChoiceProvider>);
  expect(screen.queryByText("Private wardrobe")).toBeNull();
  expect(screen.getByRole("heading",{name:"Your style"})).toBeTruthy();
  expect(screen.queryByRole("button",{name:"Continue as guest"})).toBeNull();
});
test("backend rejection exposes recovery; explicit guest survives late account confirmation", () => {
  const content=(ready:boolean)=><GuestChoiceProvider><AuthEntry ready={ready} phase="unavailable" accountAvailable={ready} guest={<div>Guest capture</div>}><div>Private wardrobe</div></AuthEntry></GuestChoiceProvider>;
  const view=render(content(false));
  expect(screen.getByRole("alert").textContent).toContain("could not be confirmed");
  fireEvent.click(screen.getByRole("button",{name:"Continue as guest"}));
  view.rerender(content(true));
  expect(screen.queryByText("Private wardrobe")).toBeNull();
  expect(screen.getByText("Guest capture")).toBeTruthy();
  fireEvent.click(screen.getByRole("button",{name:"Use my wardrobe"}));
  expect(screen.getByText("Private wardrobe")).toBeTruthy();
});
