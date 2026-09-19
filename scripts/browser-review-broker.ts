import { resolve } from "node:path";
import { mkdir, lstat } from "node:fs/promises";

// For trusted repository candidates on Desktop. Browser execution lives outside
// the nested Codex sandbox, but in the exported synthetic workspace. The reviewer
// supplies a bounded UI plan, never a shell command, URL origin, or credential.
export function startBrowserBroker(workspace: string, env: Record<string, string>) {
  const directory = resolve(workspace, "output/review");
  const seen = new Set<string>();
  let busy = false;
  let active: ReturnType<typeof Bun.spawn> | undefined;
  const timer = setInterval(async () => {
    if (busy) return;
    busy = true;
    try {
      const request = Bun.file(resolve(directory, "browser-request.json"));
      if (!await request.exists()) return;
      const stat = await lstat(request.name!);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 32_000) return;
      const { id, plan } = await request.json();
      if (typeof id !== "string" || !/^[a-z0-9-]{1,32}$/.test(id) || seen.has(id) || seen.size >= 6) return;
      seen.add(id);
      const output = resolve(directory, "browser-evidence", id);
      await mkdir(output, { recursive: true });
      const planPath = resolve(output, "plan.json");
      await Bun.write(planPath, JSON.stringify(plan));
      const log = Bun.file(resolve(output, "runner.log"));
      active = Bun.spawn(["bun", "run", "probe:browser", "--plan", planPath, "--output", output, "--port", "43829"], { cwd: workspace, env, stdout: log, stderr: log });
      const exitCode = await active.exited;
      active = undefined;
      await Bun.write(resolve(output, "completed.json"), JSON.stringify({ id, exitCode, artifactDirectory: output }));
    } catch { /* An atomic rewrite may be in progress; retry at the next tick. */ }
    finally { busy = false; }
  }, 250);
  return () => { clearInterval(timer); active?.kill(); };
}
