import { afterEach, expect, test } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import React from "react";
GlobalRegistrator.register();
const { render, screen, fireEvent, cleanup } = await import("@testing-library/react");
const { default: PlanError } = await import("../app/fits/plan/error");
const { default: DiaryError } = await import("../app/fits/diary/error");
afterEach(cleanup);
for (const [view, ErrorView] of [["plan", PlanError], ["diary", DiaryError]] as const) {
  test(`${view} route failure exposes an actionable reset without leaking error payload`, () => {
    let resetCalls = 0;
    render(<ErrorView error={new Error("private backend detail")} reset={() => {resetCalls++;}} />);
    expect(screen.getByRole("alert").textContent).toContain("could not load");
    expect(screen.queryByText("private backend detail")).toBeNull();
    fireEvent.click(screen.getByRole("button", {name:`Retry ${view}`}));
    expect(resetCalls).toBe(1);
  });
}
