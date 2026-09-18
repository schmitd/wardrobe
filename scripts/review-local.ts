import { resolve } from "node:path";
import { mkdir, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { parseArgs } from "node:util";
import { buildContext, git } from "./review-context";
import { startBrowserBroker } from "./browser-review-broker";

// Run from a trusted checkout. The reviewer has no publishing role.
const root = resolve(import.meta.dir, "..");
const { values } = parseArgs({ args: Bun.argv.slice(2), options: { base: { type: "string", default: "origin/main" }, head: { type: "string", default: "HEAD" }, output: { type: "string", default: "output/review" }, "desktop-browser": { type: "boolean", default: false } } });
if (git(["status", "--porcelain", "--untracked-files=normal"])) throw new Error("Commit the candidate first: review evidence must bind to an immutable revision");
const output = resolve(root, values.output!);
const manifest = await buildContext(values.base!, values.head!, output);
const isolated = await mkdtemp(resolve(tmpdir(), "wardrobe-review-"));
const env = Object.fromEntries(["PATH", "HOME", "TMPDIR", "LANG", "CODEX_HOME", "PLAYWRIGHT_CHANNEL"].flatMap(key => process.env[key] ? [[key, process.env[key]!]] : []));
async function run(command: string[], cwd: string, stdout: "inherit" | ReturnType<typeof Bun.file> = "inherit") {
  const child = Bun.spawn(command, { cwd, env, stdout, stderr: "inherit", stdin: "ignore" });
  if (await child.exited) throw new Error(`Command failed: ${command[0]} ${command[1]}`);
}
const archive = resolve(output, "candidate.tar");
await run(["git", "archive", "--format=tar", `--output=${archive}`, manifest.head], root);
await run(["tar", "-xf", archive, "-C", isolated], root);
await run(["git", "init", "--quiet"], isolated);
await run(["git", "add", "."], isolated);
await run(["git", "-c", "core.hooksPath=/dev/null", "-c", "commit.gpgsign=false", "-c", "user.name=Wardrobe validation", "-c", "user.email=validation@localhost", "commit", "--quiet", "-m", "Isolated candidate baseline"], isolated);
await run(["bun", "install", "--frozen-lockfile", "--ignore-scripts"], isolated);
// No .env, deploy credentials, GitHub tokens or local hooks are copied.
await mkdir(resolve(isolated, "output/review"), { recursive: true });
for (const file of ["manifest.json", "context.md", "change.diff"]) await Bun.write(resolve(isolated, "output/review", file), Bun.file(resolve(output, file)));
const prompt = await Bun.file(resolve(root, ".github/codex/prompts/adversarial.md")).text();
const browserInstructions = values["desktop-browser"] ? `The trusted Desktop browser runner is available through a file request. Do not run Playwright directly in the nested sandbox. Invent a focused browser hypothesis and write output/review/browser-request.json as {"id":"unique-lowercase-id","plan":{"viewport":{"width":390,"height":844},"steps":[...]}} using the documented plan operations. Wait for output/review/browser-evidence/ID/completed.json (check at one-second intervals for up to 60 seconds). Inspect report.json, fixture.json, runner.log and final.png there; the parent runner executes this exact candidate with synthetic data. You may submit up to six different plans sequentially. A nonzero exit is not a pass: correct a mistaken selector or report a confirmed issue. Include each chosen plan, hypothesis, result and artifact in your report. This is dynamic computer use evidence, not a substitute for proving live providers.\n` : "";
const fullPrompt = `${prompt}\n\n${browserInstructions}\nReview manifest: output/review/manifest.json. Base ${manifest.base}; head ${manifest.head}. This is an isolated exported candidate, so git has no original history; use the provided diff and source files. Run relevant narrow commands, invent and execute at least one falsifiable dynamic/property probe where behavior changed, and inspect its evidence. Temporary files belong under output/. Do not change application source. Write the final structured result using these exact base/head values. A validation gap makes the verdict incomplete. Ordinary intentionally excluded provider/device coverage is documented scope, not an automatic gap unless changed behavior depends on it.\n`;
await Bun.write(resolve(output, "workspace.txt"), isolated);
console.log(`Isolated review workspace: ${isolated}`);
const stopBrowserBroker = values["desktop-browser"] ? startBrowserBroker(isolated, env) : () => {};
try {
await run(["codex", "exec", "--ephemeral", "--ignore-user-config", "--ignore-rules", "--disable", "plugins", "--disable", "apps", "--sandbox", "workspace-write", "-C", isolated, "--output-schema", resolve(root, ".github/codex/schemas/review.json"), "--output-last-message", resolve(isolated, "output/review/result.json"), "--json", fullPrompt], isolated, Bun.file(resolve(output, "events.jsonl")));
} finally { stopBrowserBroker(); }
await Bun.write(resolve(output, "result.json"), Bun.file(resolve(isolated, "output/review/result.json")));
console.log(`Review result: ${resolve(output, "result.json")}`);
