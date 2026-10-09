import { expect, mock, test } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import React from "react";
GlobalRegistrator.register();
const { render, screen, fireEvent, waitFor, cleanup } = await import("@testing-library/react");
const { default: DayVoiceInput } = await import("./DayVoiceInput");

test("microphone failure keeps existing typed plans usable and releases busy state", async () => {
  const text = mock(() => {}), busy = mock((value: boolean) => { void value; });
  render(<DayVoiceInput hasText onText={text} onBusyChange={busy} />);
  fireEvent.click(screen.getByRole("button", { name: "Tap to dictate" }));
  await waitFor(() => expect(screen.getByText(/Your typed plans are ready to use/)).toBeTruthy());
  expect(screen.queryByRole("alert")).toBeNull();
  expect(busy.mock.calls.at(-1)).toEqual([false]);
  expect(text).not.toHaveBeenCalled();
  expect((screen.getByRole("button", { name: "Tap to dictate" }) as HTMLButtonElement).disabled).toBe(false);
  cleanup();
});
