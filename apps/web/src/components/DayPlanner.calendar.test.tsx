import { afterEach, expect, mock, test } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import React from "react";

GlobalRegistrator.register();
const { render, screen, fireEvent, cleanup, waitFor } = await import("@testing-library/react");
const reauthorize = mock(async () => ({}));
let rejectList: (error: Error) => void;
let resolveList: (value: unknown) => void;
const request = mock(async (input: { operation: string }) => {
  if (input.operation === "planning_load") return {
    items: [], plans: [], suggestions: [], calendarEnabled: true, calendarIds: ["fixture-calendar"],
    autoPlan: { enabled: false, state: "paused", timezone: "UTC", nextAt: Date.now() + 86400000 },
  };
  if (input.operation === "planning_auto") return { ok: true };
  if (input.operation === "planning_week") throw new Error("Fixture Calendar read unavailable");
  if (input.operation === "calendar_list") return new Promise((resolve, reject) => { resolveList = resolve; rejectList = reject; });
  throw new Error(`Unexpected operation ${input.operation}`);
});
mock.module("@clerk/nextjs", () => ({ useUser: () => ({ user: { id: "qa-calendar-user", externalAccounts: [{ provider: "google", reauthorize }] } }) }));
mock.module("@/lib/planning-client", () => ({ planningRequest: request }));
mock.module("./DayVoiceInput", () => ({ default: () => null }));
mock.module("next/image", () => ({ default: () => null }));
const { default: DayPlanner } = await import("./DayPlanner");
const { default: GoogleCalendarConnect } = await import("./GoogleCalendarConnect");
afterEach(() => { cleanup(); sessionStorage.clear(); request.mockClear(); reauthorize.mockClear(); });

test("Calendar selection is not availability; failed reads preserve the editable draft across close and reload", async () => {
  const view = render(<DayPlanner />);
  await waitFor(() => expect(screen.getByText("Calendar unavailable. You can still get an everyday outfit or describe your plans.")).toBeTruthy());
  fireEvent.click(screen.getByRole("button", { name: "Describe your day or week" }));
  const draft = "QA draft: work and skating today";
  fireEvent.change(screen.getByRole("textbox", { name: "Describe your day or week" }), { target: { value: draft } });
  expect(screen.getByRole("button", { name: "Google Calendar selected" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Google Calendar connected" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Google Calendar selected" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Reading calendars…" })).toBeTruthy());
  expect(screen.queryByRole("button", { name: "Connecting…" })).toBeNull();
  rejectList(new Error("Fixture list read failed"));
  await waitFor(() => expect(screen.getByText("Calendar could not be read. Your draft is still here; continue without Calendar or retry later.")).toBeTruthy());
  expect(reauthorize).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Done" }));
  fireEvent.click(screen.getByRole("button", { name: "Describe your day or week" }));
  expect((screen.getByRole("textbox", { name: "Describe your day or week" }) as HTMLTextAreaElement).value).toBe(draft);
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  view.unmount();
  render(<DayPlanner />);
  await waitFor(() => expect((screen.getByRole("button", { name: "Describe your day or week" }) as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(screen.getByRole("button", { name: "Describe your day or week" }));
  await waitFor(() => expect((screen.getByRole("textbox", { name: "Describe your day or week" }) as HTMLTextAreaElement).value).toBe(draft));
  expect(request.mock.calls.every(([input]: [{ operation: string }]) => ["planning_load", "planning_week", "calendar_list", "planning_auto"].includes(input.operation))).toBe(true);
});

test("a successful existing Calendar read exposes selection without starting authorization", async () => {
  render(<GoogleCalendarConnect enabled onChange={() => {}} />);
  await waitFor(() => expect(screen.getByRole("button", { name: "Reading calendars…" })).toBeTruthy());
  resolveList({ calendars: [{ id: "fixture-calendar", name: "Fixture calendar", primary: true }], truncated: false });
  await waitFor(() => expect(screen.getByRole("button", { name: "Use selected calendars" })).toBeTruthy());
  expect((screen.getByRole("checkbox", { name: "Fixture calendar" }) as HTMLInputElement).checked).toBe(true);
  expect(reauthorize).not.toHaveBeenCalled();
});

test("authorization failure is distinct from a Calendar read failure and keeps the draft", async () => {
  const changed = mock(() => {});
  const persist = mock(() => sessionStorage.setItem("fixture-planner-draft", "fixture preserved draft"));
  reauthorize.mockImplementationOnce(async () => { throw new Error("Fixture authorization canceled"); });
  render(<GoogleCalendarConnect enabled={false} beforeAuthorize={persist} onChange={changed} />);
  fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));
  await waitFor(() => expect(screen.getByText("Google authorization did not finish. Your draft is still here; continue without Calendar or retry later.")).toBeTruthy());
  expect(persist).toHaveBeenCalledTimes(1);
  expect(reauthorize).toHaveBeenCalledTimes(1);
  expect(request).not.toHaveBeenCalled();
  expect(changed).not.toHaveBeenCalled();
  expect(sessionStorage.getItem("fixture-planner-draft")).toBe("fixture preserved draft");
});
