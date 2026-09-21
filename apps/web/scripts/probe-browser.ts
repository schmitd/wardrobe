import { resolve } from "node:path";
import { mkdir } from "node:fs/promises";
import { parseArgs } from "node:util";
import { chromium, type Locator } from "playwright";
import { boundedInteger } from "../validation/property-options";

// Plans express UI actions, never executable JavaScript or external URLs.
const { values } = parseArgs({ args: Bun.argv.slice(2), options: { plan: { type: "string" }, port: { type: "string" }, output: { type: "string" } } });
if (!values.plan) throw new Error("Usage: bun run probe:browser --plan output/plan.json [--port 4174] [--output output/probe]");
const planFile = Bun.file(resolve(import.meta.dir, "../../..", values.plan));
if (planFile.size > 32_000) throw new Error("Plan exceeds 32 KB");
const plan = await planFile.json();
if (!plan || !Array.isArray(plan.steps) || plan.steps.length < 1 || plan.steps.length > 30) throw new Error("Plan requires 1..30 steps");
const width = boundedInteger(plan.viewport?.width?.toString(), 1100, 320, 1920);
const height = boundedInteger(plan.viewport?.height?.toString(), 800, 480, 1600);
const output = resolve(import.meta.dir, "../../..", values.output ?? "output/probe-browser");
const port = boundedInteger(values.port, 4174, 1024, 65535);
const origin = `http://127.0.0.1:${port}`;
const token = crypto.randomUUID();
function short(value: unknown): string { if (typeof value !== "string" || value.length > 4000) throw new Error("Expected bounded text"); return value; }
for (const step of plan.steps) {
  if (!["goto", "click", "fill", "select", "press", "upload", "visible", "text", "screenshot"].includes(step?.action)) throw new Error("Unknown action");
  if (step.action === "goto" && (new URL(short(step.path), origin).origin !== origin || !step.path.startsWith("/"))) throw new Error("Navigation must remain in the synthetic gallery");
  for (const field of ["role", "name", "label", "value"]) if (step[field] !== undefined) short(step[field]);
}
await mkdir(output, { recursive: true });
const log = Bun.file(resolve(output, "server.log"));
const server = Bun.spawn(["bun", "run", "validation/browser/server.ts"], { cwd: resolve(import.meta.dir, ".."), env: { ...process.env, PROBE_PORT: String(port), PROBE_TOKEN: token }, stdout: log, stderr: log });
const events: unknown[] = [];
const record = (event: unknown) => { if (events.length < 500) events.push(event); };
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
let failure: unknown;
process.once("SIGTERM", () => { server.kill(); void browser?.close(); });
const watchdog = setTimeout(() => { server.kill(); void browser?.close(); }, 90_000);
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    if (server.exitCode !== null) throw new Error("Fixture server exited; check server.log");
    try { ready = (await fetch(`${origin}/health`).then(response => response.text())) === token; } catch { /* startup */ }
    if (ready) break;
    await Bun.sleep(100);
  }
  if (!ready) throw new Error("Fixture server did not become ready");
  browser = await chromium.launch(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {});
  const context = await browser.newContext({ viewport: { width, height }, locale: "en-US", timezoneId: "America/New_York", serviceWorkers: "block" });
  context.setDefaultTimeout(5000);
  await context.route("**/*", route => {
    const url = new URL(route.request().url());
    if (url.origin === origin || ["blob:", "data:"].includes(url.protocol)) return route.continue();
    record({ type: "blocked-network", url: url.href }); return route.abort();
  });
  await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
  const page = await context.newPage();
  page.on("console", message => record({ type: "console", level: message.type(), message: message.text().slice(0, 2000) }));
  page.on("pageerror", error => record({ type: "pageerror", message: error.message }));
  page.on("requestfinished", request => record({ type: "request", url: request.url(), method: request.method(), timing: request.timing() }));
  const locate = (step: { label?: string; role?: string; name?: string; exact?: boolean }): Locator => step.label ? page.getByLabel(step.label, { exact: step.exact !== false }) : page.getByRole(step.role as Parameters<typeof page.getByRole>[0], { name: short(step.name), exact: step.exact !== false });
  try {
    for (const [index, step] of plan.steps.entries()) {
      const start = performance.now();
      if (step.action === "goto") await page.goto(new URL(step.path, origin).href);
      else if (step.action === "screenshot") await page.screenshot({ path: resolve(output, `step-${index}.png`), fullPage: true });
      else {
        const locator = locate(step);
        switch (step.action) {
          case "click": await locator.click(); break;
          case "fill": await locator.fill(short(step.value)); break;
          case "select": await locator.selectOption(short(step.value)); break;
          case "press": await locator.press(short(step.value)); break;
          case "visible": await locator.waitFor({ state: "visible" }); break;
          case "text": await locator.filter({ hasText: short(step.value) }).waitFor({ state: "visible" }); break;
          case "upload": { const [chooser] = await Promise.all([page.waitForEvent("filechooser"), locator.click()]); await chooser.setFiles({ name: "synthetic.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==", "base64") }); break; }
        }
      }
      record({ type: "step", index, action: step.action, elapsedMs: performance.now() - start });
    }
    if (events.some(event => (event as { type: string }).type === "pageerror")) throw new Error("Browser raised an uncaught error");
  } finally {
    await page.screenshot({ path: resolve(output, "final.png"), fullPage: true }).catch(() => {});
    await Bun.write(resolve(output, "fixture.json"), await page.request.get(`${origin}/__fixture/state`).then(r => r.text()).catch(() => "null"));
    await context.tracing.stop({ path: resolve(output, "trace.zip") });
  }
} catch (error) { failure = error; }
finally {
  clearTimeout(watchdog); await browser?.close(); server.kill(); await server.exited;
  await Bun.write(resolve(output, "report.json"), JSON.stringify({ ok: !failure, error: failure ? String(failure) : null, scope: "real UI components with synthetic external boundaries", plan, events }, null, 2));
}
console.log(output);
if (failure) throw failure;
