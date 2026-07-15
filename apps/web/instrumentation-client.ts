import posthog from "posthog-js";

const projectToken = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;

if (projectToken) {
  posthog.init(projectToken, {
    api_host: "/ingest",
    ui_host: "https://us.posthog.com",
    defaults: "2026-01-30",
    capture_exceptions: true,
    session_recording: {
      maskAllInputs: true,
      maskTextSelector: "[data-private]",
    },
    debug: process.env.NODE_ENV === "development",
  });
}
