import type { Page } from "playwright/test";

type Probe = {
  requests: number; stops: number; active: number; maximum: number;
  constraints: MediaStreamConstraints[]; resolve: () => void;
};
declare global { interface Window { cameraProbe: Probe } }

/** Synthetic canvas video only: never asks the browser for hardware access. */
export async function cameraFixture(page: Page, mode: "allow" | "pending" | "deny" | "busy" | "missing" = "allow") {
  await page.addInitScript(mode => {
    const resolvers: (() => void)[] = [];
    const probe: Probe = { requests: 0, stops: 0, active: 0, maximum: 0, constraints: [], resolve: () => resolvers.shift()?.() };
    window.cameraProbe = probe;
    const stream = () => {
      const canvas = document.createElement("canvas"); canvas.width = 640; canvas.height = 480;
      const context = canvas.getContext("2d")!;
      context.fillStyle = "#2859a0"; context.fillRect(0, 0, 640, 480);
      context.fillStyle = "#dce66e"; context.fillRect(160, 120, 320, 240);
      const video = canvas.captureStream(10);
      probe.active++; probe.maximum = Math.max(probe.maximum, probe.active);
      const timer = setInterval(() => context.fillRect(160, 120, 320, 240), 100);
      const track = video.getVideoTracks()[0]!;
      const stop = track.stop.bind(track); let stopped = false;
      track.stop = () => { if (!stopped) { stopped = true; clearInterval(timer); probe.stops++; probe.active--; } stop(); };
      return video;
    };
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: mode === "missing" ? undefined : {
      getUserMedia: (constraints: MediaStreamConstraints) => {
        probe.requests++; probe.constraints.push(constraints);
        if (mode === "deny" || mode === "busy") return Promise.reject(new DOMException("Synthetic camera failure", mode === "deny" ? "NotAllowedError" : "NotReadableError"));
        if (mode === "pending") return new Promise<MediaStream>(resolve => resolvers.push(() => resolve(stream())));
        return Promise.resolve(stream());
      },
    } });
  }, mode);
}
