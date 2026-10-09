import { afterEach, expect, mock, test } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import React from "react";

GlobalRegistrator.register();
const { render, screen, cleanup, waitFor } = await import("@testing-library/react");
let auth = { isLoaded: false, isSignedIn: false };
const replace = mock(() => {});
let entry: { path: string; routing: string; forceRedirectUrl: string; fallbackRedirectUrl: string };
mock.module("@clerk/nextjs", () => ({
  useAuth: () => auth,
  SignIn: (props: typeof entry) => { entry = props; return <div>Clerk sign-in entry</div>; },
}));
mock.module("next/navigation", () => ({ useRouter: () => ({ replace }) }));
const { default: SignInPage } = await import("../app/sign-in/[[...sign-in]]/page");
afterEach(() => { cleanup(); sessionStorage.clear(); replace.mockClear(); auth = { isLoaded: false, isSignedIn: false }; });

test("candidate guest link has a matching Clerk path entry and same-tab escape while auth is pending", () => {
  sessionStorage.setItem("wardrobe.guestSnapshot.v1", "fixture guest draft");
  render(<SignInPage />);
  expect(screen.getByRole("heading", { name: "Sign in to Lint" })).toBeTruthy();
  expect(screen.getByRole("status").textContent).toContain("Loading sign-in");
  expect(entry).toMatchObject({ routing: "path", path: "/sign-in", forceRedirectUrl: "/", fallbackRedirectUrl: "/" });
  expect(screen.getByRole("link", { name: "Return to guest wardrobe" }).getAttribute("href")).toBe("/");
  expect(sessionStorage.getItem("wardrobe.guestSnapshot.v1")).toBe("fixture guest draft");
  expect(replace).not.toHaveBeenCalled();
});

test("restored signed-in session returns home without deleting the guest draft", async () => {
  sessionStorage.setItem("wardrobe.guestSnapshot.v1", "fixture guest draft");
  const view = render(<SignInPage />);
  auth = { isLoaded: true, isSignedIn: true };
  view.rerender(<SignInPage />);
  await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
  expect(screen.queryByRole("status")).toBeNull();
  expect(sessionStorage.getItem("wardrobe.guestSnapshot.v1")).toBe("fixture guest draft");
});
