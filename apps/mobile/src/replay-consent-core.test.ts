import { expect, test } from "bun:test";
import { createReplayConsent } from "./replay-consent-core";

function fixture(available = true) {
  const calls: string[] = [];
  const state = { consent: false, optedOut: false, failRead: false, failWrite: false };
  const controller = createReplayConsent({
    available, optedOut: () => state.optedOut,
    read: async () => { if (state.failRead) throw new Error("storage"); return state.consent; },
    write: async (enabled) => { if (state.failWrite) throw new Error("storage"); state.consent = enabled; calls.push(`write:${enabled}`); },
    start: async () => { calls.push("start"); }, stop: async () => { calls.push("stop"); },
  });
  return { controller, calls, state };
}
test("replay requires separate consent and verified build", async () => {
  const f = fixture();
  await f.controller.sync(true);
  expect(f.calls).toEqual(["stop"]);
  await f.controller.set(true);
  expect(f.calls.slice(-2)).toEqual(["write:true", "start"]);
  await expect(fixture(false).controller.set(true)).rejects.toThrow("unavailable");
});
test("analytics opt-out and signed-out sessions never restart recordings", async () => {
  const f = fixture(); f.state.consent = true; f.state.optedOut = true;
  await f.controller.sync(true);
  await expect(f.controller.set(true)).rejects.toThrow("unavailable");
  f.state.optedOut = false;
  await f.controller.sync(false);
  expect(f.calls).toEqual(["stop", "stop"]);
});
test("storage failure stops capture and never grants consent", async () => {
  const f = fixture(); f.state.failRead = true;
  await expect(f.controller.sync(true)).rejects.toThrow("storage");
  f.state.failWrite = true;
  await expect(f.controller.set(false)).rejects.toThrow("storage");
  expect(f.calls).toEqual(["stop", "stop"]);
});
test("rapid enable then disable finishes stopped with consent revoked", async () => {
  const f = fixture();
  await Promise.all([f.controller.set(true), f.controller.set(false)]);
  expect(f.calls).toEqual(["write:true", "start", "stop", "write:false"]);
  expect(f.state.consent).toBe(false);
});
