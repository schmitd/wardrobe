import { resolve } from "node:path";
import { parseArgs } from "node:util";

const root = resolve(import.meta.dir, "..");
const web = resolve(root, "apps/web");
const { values, positionals } = parseArgs({ args: Bun.argv.slice(2), allowPositionals: true, options: {
  seed: { type: "string" }, runs: { type: "string" }, path: { type: "string" }, grep: { type: "string" },
} });
const suite = positionals[0] ?? "core";
if (positionals.length > 1) throw new Error("One suite at a time: core | storage | planning | reads | fuzz | browser | generated | all");
const files: Record<string, string[]> = {
  core: ["confect/storage.integration.test.ts", "confect/readModels.integration.test.ts", "confect/legacy/planning.test.ts", "src/server/progressStream.test.ts"],
  storage: ["confect/storage.integration.test.ts"],
  planning: ["confect/legacy/planning.test.ts", "src/lib/planning.test.ts"],
  reads: ["confect/readModels.integration.test.ts"],
  fuzz: ["validation/planning.fuzz.test.ts", "validation/storage.fuzz.test.ts"],
};
const env = { ...process.env, ...(values.seed ? { FUZZ_SEED: values.seed } : {}), ...(values.runs ? { FUZZ_RUNS: values.runs } : {}), ...(values.path ? { FUZZ_PATH: values.path } : {}) };
async function run(cmd: string[], cwd = web) {
  const child = Bun.spawn(cmd, { cwd, env, stdout: "inherit", stderr: "inherit" });
  const code = await child.exited;
  if (code) process.exit(code);
}
if (suite === "generated") {
  await run(["bun", "run", "--bun", "confect", "codegen"], root);
  const paths = ["apps/web/confect/_generated", "apps/web/convex"];
  const status = Bun.spawnSync(["git", "status", "--porcelain", "--untracked-files=all", "--", ...paths], { cwd: root });
  if (status.exitCode || status.stdout.toString().trim()) throw new Error(`Generated adapters differ from this revision (including new files):\n${status.stdout}`);
} else if (suite === "browser") {
  await run(["bun", "run", "playwright", "test", "-c", "validation/browser/playwright.config.ts", ...(values.grep ? ["--grep", values.grep] : [])]);
} else if (suite === "all") {
  await run(["bun", "run", "lint"], root);
  await run(["bun", "run", "typecheck"], root);
  await run(["bun", "run", "test"], root);
  await run(["bun", "run", "validate", "browser"], root);
} else if (files[suite]) {
  await run(["bun", "test", ...files[suite], ...(values.grep ? ["--test-name-pattern", values.grep] : [])]);
} else throw new Error(`Unknown suite: ${suite}`);
