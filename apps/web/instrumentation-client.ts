import posthog from "posthog-js";
import { replayPrivacy } from "./src/lib/replay-privacy";

const projectToken = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;

if (projectToken) {
  posthog.init(projectToken, {
    api_host: "/ingest",
    ui_host: "https://us.posthog.com",
    defaults: "2026-01-30",
    capture_exceptions: true,
    session_recording: replayPrivacy,
    enable_recording_console_log: false,
    debug: process.env.NODE_ENV === "development",
  });
}
