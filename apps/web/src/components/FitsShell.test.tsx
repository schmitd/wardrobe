import { test, expect, mock } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
const pending = new Promise<never>(() => {});
mock.module("@clerk/nextjs", () => ({
  useAuth: () => ({ isLoaded: false, userId: null }),
}));
mock.module("convex/react", () => ({
  useConvexAuth: () => ({ isLoading: true, isAuthenticated: false }),
}));
mock.module("next/navigation", () => ({
  useSearchParams: () => {
    throw pending;
  },
}));
mock.module("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
const { default: Page } = await import("../app/fits/page");
for (const view of ["plan", "diary"])
  test(`actual /fits server query selects ${view} shell before parameters or auth resolve`, async () => {
    const html = renderToStaticMarkup(
      await Page({ searchParams: Promise.resolve({ view }) }),
    );
    expect(html).toContain("Fits");
    expect(html).toContain("Fits views");
    expect(html).toContain(
      view === "diary" ? "Daily fit calendar" : "Week outfit planner",
    );
    expect(html).not.toContain(view === "diary" ? "This week" : "Recent fits");
    expect(html).not.toContain("data-private");
    expect(html).not.toContain("no fit recorded");
    expect(html).not.toContain("Retry loading outfits");
  });
