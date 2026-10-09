import { afterEach, expect, mock, test } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import React from "react";
GlobalRegistrator.register();
const { render, screen, fireEvent, cleanup, waitFor } = await import("@testing-library/react");
let resolveAnalysis: (value: unknown) => void;
const analyze = mock(() => new Promise(resolve => { resolveAnalysis = resolve; }));
mock.module("@/app/actions/wardrobe", () => ({ analyzeGuestFitCheckAction: analyze }));
mock.module("@clerk/nextjs", () => ({ SignInButton: ({ children }: { children: React.ReactNode }) => children, SignUpButton: ({ children }: { children: React.ReactNode }) => children }));
mock.module("@/lib/imageClient", () => ({ downscaleToJpegDataUrl: async () => ({ mimeType: "image/jpeg", dataUrl: "data:image/jpeg;base64,c2FtcGxl" }) }));
mock.module("posthog-js", () => ({ default: { capture: () => {}, captureException: () => {} } }));
const { default: GuestClosetDemo } = await import("./GuestClosetDemo");
afterEach(() => { cleanup(); localStorage.clear(); analyze.mockClear(); });

test("guest has distinct camera/gallery and visible sign-in; cancel does not start analysis", () => {
  render(<GuestClosetDemo />);
  expect(screen.getByRole("button", { name: "Take photo" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Choose photo" })).toBeTruthy();
  expect(screen.getByRole("link", { name: "Sign in" })).toBeTruthy();
  const camera = screen.getByLabelText("Take outfit photo"), gallery = screen.getByLabelText("Choose outfit photo");
  expect(camera.getAttribute("capture")).toBe("environment");
  expect(gallery.hasAttribute("capture")).toBe(false);
  fireEvent.change(gallery, { target: { files: [] } });
  expect(analyze).not.toHaveBeenCalled();
});

test("repeated file events coalesce; a failed or interrupted capture can be reopened", async () => {
  const first = render(<GuestClosetDemo />);
  const input = screen.getByLabelText("Choose outfit photo");
  const files = [new File(["sample"], "QA.jpg", { type: "image/jpeg" })];
  fireEvent.change(input, { target: { files } });
  fireEvent.change(input, { target: { files } });
  await waitFor(() => expect(analyze).toHaveBeenCalledTimes(1));
  resolveAnalysis({ kind: "error", message: "Photo unavailable" });
  await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("Photo unavailable"));
  expect((screen.getByRole("button", { name: "Choose photo" }) as HTMLButtonElement).disabled).toBe(false);
  fireEvent.change(input, { target: { files } });
  await waitFor(() => expect(analyze).toHaveBeenCalledTimes(2));
  first.unmount();
  resolveAnalysis({ kind: "error", message: "Interrupted" });
  render(<GuestClosetDemo />);
  expect((screen.getByRole("button", { name: "Choose photo" }) as HTMLButtonElement).disabled).toBe(false);
});
