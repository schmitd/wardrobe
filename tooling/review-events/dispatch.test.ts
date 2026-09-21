import { expect, test } from "bun:test";

// Isolate module fakes from the receiver/store/real filesystem tests.
test("controller exercises publish, CI waiting, findings, stale revisions and failures without external services", async () => {
  const child = Bun.spawn(["bun", "dispatch-probe.ts"], { cwd: import.meta.dir, stdout: "pipe", stderr: "pipe" });
  const [out, err, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
  if (code) throw new Error(out + err);
  expect(out).toContain("13 controller scenarios passed");
});
