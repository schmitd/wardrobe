import { createInterface } from "node:readline";
import { resolve } from "node:path";

// Small terminal client for Bun's WebKit Inspector Protocol (not Chrome CDP).
// JSON commands on stdin keep the same paused process alive across agent calls.
const args = Bun.argv.slice(2);
const separator = args.indexOf("--");
if (separator < 0 || !args[separator + 1]) {
  console.log('Usage: bun run debug [--cwd directory] -- test path.test.ts [--test-name-pattern name]\nJSON commands: sources, source, break, remove, stack, locals, eval, continue, pause, next, step, out, exceptions, quit. See docs/DEBUGGING.md.');
  process.exit(separator < 0 && args.length === 0 ? 0 : 1);
}
const options = args.slice(0, separator);
if (options.length && (options.length !== 2 || options[0] !== "--cwd")) throw new Error("Only --cwd is supported before --");
const cwd = resolve(options[1] ?? process.cwd());
const env = Object.fromEntries(["PATH", "HOME", "TMPDIR", "TMP", "TEMP", "TZ", "SYSTEMROOT"].flatMap(key => process.env[key] ? [[key, process.env[key]!]] : []));
const child = Bun.spawn([process.execPath, "--no-env-file", `--inspect-brk=127.0.0.1:0/${crypto.randomUUID()}`, ...args.slice(separator + 1)], { cwd, env, stdout: "inherit", stderr: "pipe", stdin: "ignore" });
let socket: WebSocket | undefined;
let finished = false;
const finish = (code: number) => {
  if (finished) return;
  finished = true;
  socket?.close();
  child.kill();
  process.exit(code);
};
process.on("SIGINT", () => finish(130));
process.on("SIGTERM", () => finish(143));
process.on("exit", () => { child.kill(); });
void child.exited.then(code => { console.log(JSON.stringify({ event: "exit", code })); finish(code); });
const endpoint = Promise.withResolvers<string>();
void (async () => {
  let pending = "";
  const reader = child.stderr.getReader();
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    process.stderr.write(chunk);
    pending = (pending + chunk).slice(-8192);
    const url = pending.match(/ws:\/\/127\.0\.0\.1:\d+\/[a-zA-Z0-9-]+/);
    if (url) endpoint.resolve(url[0]);
  }
})();
const startupTimeout = setTimeout(() => { console.error("Inspector did not start within 10 seconds"); finish(1); }, 10_000);
const url = await endpoint.promise;
socket = new WebSocket(url);
type Remote = { type?: string; subtype?: string; value?: unknown; description?: string; objectId?: string };
type Frame = { callFrameId: string; functionName: string; url: string; location: { scriptId: string; lineNumber: number; columnNumber: number }; scopeChain: { type: string; object: Remote }[] };
type Script = { scriptId: string; url: string; sourceMapURL?: string };
const scripts = new Map<string, Script>();
let frames: Frame[] = [];
let sequence = 0;
const pending = new Map<number, { resolve: (value: Record<string, unknown>) => void; reject: (reason: Error) => void; timer: ReturnType<typeof setTimeout> }>();
const emit = (value: unknown) => console.log(JSON.stringify(value));
const stack = () => frames.slice(0, 20).map((frame, index) => ({ frame: index, name: frame.functionName, scriptId: frame.location.scriptId, url: frame.url || scripts.get(frame.location.scriptId)?.url, line: frame.location.lineNumber + 1, column: frame.location.columnNumber + 1 }));
socket.addEventListener("message", event => {
  const message = JSON.parse(String(event.data));
  if (message.id !== undefined) {
    const request = pending.get(message.id);
    if (!request) return;
    clearTimeout(request.timer);
    pending.delete(message.id);
    if (message.error) request.reject(new Error(JSON.stringify(message.error)));
    else request.resolve(message.result ?? {});
  } else if (message.method === "Debugger.scriptParsed") scripts.set(message.params.scriptId, message.params);
  else if (message.method === "Debugger.paused") { frames = message.params.callFrames; emit({ event: "paused", reason: message.params.reason, stack: stack() }); }
  else if (message.method === "Debugger.resumed") { frames = []; emit({ event: "resumed" }); }
  else if (message.method === "Debugger.breakpointResolved") emit({ event: "breakpointResolved", ...message.params });
});
socket.addEventListener("close", () => { if (!finished) setTimeout(() => { console.error("Inspector disconnected while target is still running"); finish(1); }, 1000).unref(); });
await new Promise<void>((resolveOpen, reject) => { socket!.addEventListener("open", () => resolveOpen(), { once: true }); socket!.addEventListener("error", () => reject(new Error("Cannot connect to inspector")), { once: true }); });
const request = (method: string, params = {}): Promise<Record<string, unknown>> => new Promise((resolveResult, reject) => {
  const id = ++sequence;
  const timer = setTimeout(() => { pending.delete(id); reject(new Error(`${method} timed out`)); }, 10_000);
  pending.set(id, { resolve: resolveResult, reject, timer });
  socket!.send(JSON.stringify({ id, method, params }));
});
await request("Runtime.enable");
await request("Debugger.enable");
await request("Debugger.setBreakpointsActive", { active: true });
await request("Debugger.setPauseOnExceptions", { state: "none" });
clearTimeout(startupTimeout);
let initialized = false;
emit({ event: "ready", cwd, pid: child.pid, note: "Set pending breakpoints, then continue to start. Lines are 1-based INSPECTOR SOURCE coordinates; TypeScript source maps are not applied by this client." });

type Command = { command: string; filter?: string; scriptId?: string; from?: number; count?: number; urlRegex?: string; line?: number; column?: number; condition?: string; breakpointId?: string; frame?: number; expression?: string; state?: string };
const integer = (value: number | undefined, fallback: number, min: number, max: number) => {
  const result = value ?? fallback;
  if (!Number.isInteger(result) || result < min || result > max) throw new Error(`Expected integer ${min}..${max}`);
  return result;
};
const selectedFrame = (cmd: Command) => {
  const frame = frames[integer(cmd.frame, 0, 0, Math.max(0, frames.length - 1))];
  if (!frame) throw new Error("Target is not paused");
  return frame;
};
const required = (value: string | undefined) => { if (typeof value !== "string" || !value) throw new Error("Missing string argument"); return value; };
async function execute(cmd: Command) {
  switch (cmd.command) {
    case "sources": return [...scripts.values()].filter(s => s.url.includes(cmd.filter ?? "")).map(s => ({ scriptId: s.scriptId, url: s.url, hasSourceMap: Boolean(s.sourceMapURL) }));
    case "source": {
      const scriptId = cmd.scriptId ?? selectedFrame(cmd).location.scriptId;
      const result = await request("Debugger.getScriptSource", { scriptId });
      const lines = String(result.scriptSource).split("\n");
      const from = integer(cmd.from, 1, 1, lines.length);
      const count = integer(cmd.count, 40, 1, 120);
      return { scriptId, url: scripts.get(scriptId)?.url, totalLines: lines.length, lines: lines.slice(from - 1, from - 1 + count).map((text, index) => `${from + index}: ${text.includes("//# sourceMappingURL=data:") ? "//# sourceMappingURL=[omitted]" : text}`) };
    }
    case "break": return request("Debugger.setBreakpointByUrl", { urlRegex: required(cmd.urlRegex), lineNumber: integer(cmd.line, 1, 1, 1_000_000) - 1, columnNumber: integer(cmd.column, 1, 1, 1_000_000) - 1, ...(cmd.condition ? { options: { condition: cmd.condition } } : {}) });
    case "remove": return request("Debugger.removeBreakpoint", { breakpointId: required(cmd.breakpointId) });
    case "stack": return stack();
    case "locals": {
      const frame = selectedFrame(cmd);
      return Promise.all(frame.scopeChain.filter(scope => scope.type !== "global").slice(0, 4).map(async scope => ({ type: scope.type, ...(await request("Runtime.getProperties", { objectId: scope.object.objectId, ownProperties: true, generatePreview: false, fetchCount: 30 })) })));
    }
    case "eval": return request("Debugger.evaluateOnCallFrame", { callFrameId: selectedFrame(cmd).callFrameId, expression: required(cmd.expression), returnByValue: true, generatePreview: false, doNotPauseOnExceptionsAndMuteConsole: true });
    case "exceptions": {
      if (!["none", "uncaught", "all"].includes(cmd.state ?? "")) throw new Error("state must be none, uncaught, or all");
      return request("Debugger.setPauseOnExceptions", { state: cmd.state });
    }
    case "continue":
      if (!initialized) { initialized = true; return request("Inspector.initialized"); }
      return request("Debugger.resume");
    case "next": return request("Debugger.stepOver");
    case "pause": return request("Debugger.pause");
    case "step": return request("Debugger.stepInto");
    case "out": return request("Debugger.stepOut");
    case "quit": emit({ event: "stopped", reason: "operator quit; target result unknown" }); finish(130); return;
    default: throw new Error(`Unknown command: ${cmd.command}`);
  }
}
for await (const line of createInterface({ input: process.stdin })) {
  if (!line.trim()) continue;
  try {
    if (line.length > 16_384) throw new Error("Command exceeds 16 KB");
    const cmd = JSON.parse(line) as Command;
    emit({ command: cmd.command, result: await execute(cmd) });
  } catch (error) { emit({ error: error instanceof Error ? error.message : String(error) }); }
}
emit({ event: "stopped", reason: "stdin closed; target result unknown" });
finish(130);
