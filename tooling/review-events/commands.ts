import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
export const cleanEnv = () => Object.fromEntries(["PATH", "HOME", "TMPDIR", "LANG", "CODEX_HOME", "PLAYWRIGHT_CHANNEL"].flatMap(key => process.env[key] ? [[key, process.env[key]!]] : []));
export async function command(args: string[], cwd: string, log?: string, timeoutMs = 120_000): Promise<string> {
  if (log) await mkdir(dirname(log), { recursive: true });
  const child = Bun.spawn(args, { cwd, env: cleanEnv(), stdin: "ignore", stdout: "pipe", stderr: "pipe" });
  const timer = setTimeout(() => child.kill(), timeoutMs);
  try {
    const [stdout, stderr, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
    if (log) await Bun.write(log, stdout + "\n" + stderr);
    if (code) throw new Error(`${args[0]} ${args[1]} failed (${code}); ${log ? `see ${log}` : stderr.slice(0, 500)}`);
    return stdout;
  } finally { clearTimeout(timer); }
}
export async function gh<T = any>(args: string[], cwd: string): Promise<T> { return JSON.parse(await command(["gh", ...args], cwd)); }
export async function api<T = any>(route: string, cwd: string): Promise<T> { return gh<T>(["api", route], cwd); }
