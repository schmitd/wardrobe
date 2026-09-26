import { cronJobs } from "convex/server";
import { internal } from "../convex/_generated/api";
// Native interop functions use their generated Convex references.
const jobs = cronJobs();
jobs.interval(
  "reconcile fit reminders",
  { minutes: 5 },
  internal.reminders.sweep,
  {},
);
const config = { convexCronJobs: jobs };

export default config;
