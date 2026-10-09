import { afterEach, expect, mock, test } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import React from "react";

GlobalRegistrator.register();
const { render, screen, fireEvent, cleanup, waitFor } = await import("@testing-library/react");
let calendarEnabled = true;
const reauthorize = mock(async () => ({}));
let rejectList: (error: Error) => void;
let resolveList: (value: unknown) => void;
const request = mock(async (input: { operation: string }) => {
  if (input.operation === "planning_load") return {
    items: [{id:"fixture-shirt",category:"Shirt",description:"Fixture shirt",imageUrl:null}], plans: [], suggestions: [], calendarEnabled, calendarIds: ["fixture-calendar"],
    autoPlan: { enabled: false, state: "paused", timezone: "UTC", nextAt: Date.now() + 86400000 },
  };
  if (input.operation === "planning_generate_week") return {updated:1,kept:0};
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
afterEach(() => { calendarEnabled = true; cleanup(); sessionStorage.clear(); request.mockClear(); reauthorize.mockClear(); });

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
  expect(screen.getByText(/Read-only Calendar titles, times, and locations go to OpenAI/)).toBeTruthy();
  expect(reauthorize).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));
  await waitFor(() => expect(screen.getByText("Google authorization did not finish. Your draft is still here; continue without Calendar or retry later.")).toBeTruthy());
  expect(persist).toHaveBeenCalledTimes(1);
  expect(reauthorize).toHaveBeenCalledTimes(1);
  expect(request).not.toHaveBeenCalled();
  expect(changed).not.toHaveBeenCalled();
  expect(sessionStorage.getItem("fixture-planner-draft")).toBe("fixture preserved draft");
});


test("planning entry sequences optional permissions, cancellation preserves the draft, and reload does not repeat denial", async () => {
  calendarEnabled = false;
  let deny!: () => void;
  const geo = mock((_success:unknown, failure:(error:{code:number})=>void) => { deny = () => failure({code:1}); });
  Object.defineProperty(navigator, "geolocation", {configurable:true,value:{getCurrentPosition:geo}});
  const view = render(<DayPlanner />);
  await waitFor(() => expect((screen.getByRole("button",{name:"Describe your day or week"}) as HTMLButtonElement).disabled).toBe(false));
  expect(geo).not.toHaveBeenCalled(); expect(reauthorize).not.toHaveBeenCalled();
  expect(screen.queryByRole("button",{name:"Planner options"})).toBeNull();
  expect(screen.queryByRole("combobox",{name:"City for weather (optional)"})).toBeNull();
  expect(geo).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button",{name:"Describe your day or week"}));
  expect(geo).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole("button",{name:"Continue with Google"})).toBeNull();
  deny();
  await waitFor(() => expect(screen.getByRole("button",{name:"Continue with Google"})).toBeTruthy());
  expect(reauthorize).not.toHaveBeenCalled();
  fireEvent.change(screen.getByRole("textbox",{name:"Describe your day or week"}),{target:{value:"Work and skating this week"}});
  reauthorize.mockImplementationOnce(async () => { throw new Error("Synthetic cancellation"); });
  fireEvent.click(screen.getByRole("button",{name:"Continue with Google"}));
  await waitFor(() => expect(screen.getByText(/Google authorization did not finish/)).toBeTruthy());
  expect(JSON.parse(sessionStorage.getItem("wardrobe-planner-qa-calendar-user")!).draft.description).toBe("Work and skating this week");
  fireEvent.click(screen.getByRole("button",{name:"Continue without Calendar"}));
  expect((screen.getByRole("textbox",{name:"Describe your day or week"}) as HTMLTextAreaElement).value).toBe("Work and skating this week");
  fireEvent.click(screen.getByRole("button",{name:"Close"})); view.unmount();
  render(<DayPlanner />);
  await waitFor(() => expect((screen.getByRole("button",{name:"Describe your day or week"}) as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(screen.getByRole("button",{name:"Describe your day or week"}));
  await waitFor(() => expect((screen.getByRole("textbox",{name:"Describe your day or week"}) as HTMLTextAreaElement).value).toBe("Work and skating this week"));
  expect(geo).toHaveBeenCalledTimes(1); expect(reauthorize).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole("button",{name:"Continue without Calendar"})).toBeNull();
  expect(request.mock.calls.some(([input]:[{operation:string}])=>input.operation === "calendar_connect")).toBe(false);
});

test("location denial permits an owned-wardrobe recommendation without Calendar", async () => {
  calendarEnabled = false;
  Object.defineProperty(navigator, "geolocation", {configurable:true,value:{getCurrentPosition:(_success:unknown,failure:(error:{code:number})=>void)=>failure({code:1})}});
  render(<DayPlanner />);
  await waitFor(() => expect((screen.getByRole("button",{name:"Describe your day or week"}) as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(screen.getByRole("button",{name:"Describe your day or week"}));
  await waitFor(() => expect(screen.getByRole("button",{name:"Continue without Calendar"})).toBeTruthy());
  fireEvent.click(screen.getByRole("button",{name:"Continue without Calendar"}));
  fireEvent.click(screen.getByRole("button",{name:"Suggest outfit"}));
  await waitFor(() => expect(request.mock.calls.some(([input]:[{operation:string}])=>input.operation === "planning_generate_week")).toBe(true));
  const generated = request.mock.calls.find(([input]:[{operation:string}])=>input.operation === "planning_generate_week")?.[0];
  expect(generated).toMatchObject({useCalendar:false,weatherCity:""});
  expect(reauthorize).not.toHaveBeenCalled();
});
