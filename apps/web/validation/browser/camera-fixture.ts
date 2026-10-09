import type { Page } from "playwright/test";

type Probe = {
  requests: number; stops: number; active: number; maximum: number;
  constraints: MediaStreamConstraints[]; resolve: () => void; failNext: boolean; sameCamera: boolean; unknownSettings: boolean;
};
declare global { interface Window { cameraProbe: Probe } }

/** Synthetic canvas video only: never asks the browser for hardware access. */
export async function cameraFixture(page: Page, mode: "allow" | "pending" | "deny" | "busy" | "missing" = "allow") {
  await page.addInitScript(mode => {
    const resolvers: (() => void)[] = [];
    const probe: Probe = { requests: 0, stops: 0, active: 0, maximum: 0, constraints: [], failNext: false, sameCamera: false, unknownSettings: false, resolve: () => resolvers.shift()?.() };
    window.cameraProbe = probe;
    const stream = (constraints: MediaStreamConstraints) => {
      const canvas = document.createElement("canvas"); canvas.width = 640; canvas.height = 480;
      const context = canvas.getContext("2d")!;
      context.fillStyle = "#2859a0"; context.fillRect(0, 0, 640, 480);
      context.fillStyle = "#c02020"; context.fillRect(0,0,40,480);
      context.fillStyle = "#dce66e"; context.fillRect(160, 120, 320, 240);
      const video = canvas.captureStream(10);
      probe.active++; probe.maximum = Math.max(probe.maximum, probe.active);
      const timer = setInterval(() => context.fillRect(160, 120, 320, 240), 100);
      const track = video.getVideoTracks()[0]!;
      const facing = !probe.sameCamera && typeof constraints.video === "object" && (constraints.video.facingMode as {ideal?:string})?.ideal === "user" ? "user" : "environment";
      track.getSettings = () => probe.unknownSettings ? {} : ({ facingMode: facing, deviceId: facing });
      const stop = track.stop.bind(track); let stopped = false;
      track.stop = () => { if (!stopped) { stopped = true; clearInterval(timer); probe.stops++; probe.active--; } stop(); };
      return video;
    };
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: mode === "missing" ? undefined : {
      getUserMedia: (constraints: MediaStreamConstraints) => {
        probe.requests++; probe.constraints.push(constraints);
        if (probe.failNext) { probe.failNext = false; return Promise.reject(new DOMException("Synthetic switch failure", "NotReadableError")); }
        if (mode === "deny" || mode === "busy") return Promise.reject(new DOMException("Synthetic camera failure", mode === "deny" ? "NotAllowedError" : "NotReadableError"));
        if (mode === "pending") return new Promise<MediaStream>(resolve => resolvers.push(() => resolve(stream(constraints))));
        return Promise.resolve(stream(constraints));
      },
    } });
  }, mode);
}
