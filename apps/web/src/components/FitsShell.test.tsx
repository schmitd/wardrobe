import { test, expect, mock } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
let pathname = "/fits/plan";
mock.module("@clerk/nextjs", () => ({
  useAuth: () => ({ isLoaded: false, userId: null }),
}));
mock.module("convex/react", () => ({
  useConvexAuth: () => ({ isLoading: true, isAuthenticated: false }),
}));
mock.module("next/navigation", () => ({
  usePathname: () => pathname,
  redirect: (destination: string) => {
    throw new Error(`redirect:${destination}`);
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
const { default: Layout } = await import("../app/fits/layout");
const { default: Legacy } = await import("../app/fits/page");
const { default: Plan } = await import("../app/fits/plan/page");
const { default: Diary } = await import("../app/fits/diary/page");
const { default: PlanLoading } = await import("../app/fits/plan/loading");
const { default: DiaryLoading } = await import("../app/fits/diary/loading");
for (const view of ["plan", "diary"] as const)
  test(`actual nested ${view} layout and route loading show matching public geometry without private content`, () => {
    pathname = `/fits/${view}`;
    const Page = view === "plan" ? Plan : Diary;
    const Loading = view === "plan" ? PlanLoading : DiaryLoading;
    const html = renderToStaticMarkup(
      <Layout>
        <Page />
      </Layout>,
    );
    const pending = renderToStaticMarkup(<Loading />);
    const heading =
      view === "diary" ? "Daily fit calendar" : "Week outfit planner";
    expect(html).toContain(heading);
    expect(pending).toContain(heading);
    expect(html).toContain(`href="/fits/${view}" aria-current="page"`);
    expect(html).not.toContain(view === "diary" ? "This week" : "Recent fits");
    expect(html).not.toContain("data-private");
    expect(html).not.toContain("no fit recorded");
    expect(html).not.toContain("Retry loading outfits");
  });
test("legacy Fits entry redirects to the matching leaf while preserving ordinary parameters", async () => {
  await expect(
    Legacy({
      searchParams: Promise.resolve({ view: "diary", date: "2026-10-09" }),
    }),
  ).rejects.toThrow("redirect:/fits/diary?date=2026-10-09");
  await expect(
    Legacy({ searchParams: Promise.resolve({ calendar: "connected" }) }),
  ).rejects.toThrow("redirect:/fits/plan?calendar=connected");
});
