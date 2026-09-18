import { resolve } from "node:path";
import { mkdir } from "node:fs/promises";
import { parseArgs } from "node:util";
import { createHash } from "node:crypto";

const root = resolve(import.meta.dir, "..");
export function git(args: string[]) {
  const result = Bun.spawnSync(["git", ...args], { cwd: root });
  if (result.exitCode) throw new Error(result.stderr.toString());
  return result.stdout.toString().trim();
}
export async function buildContext(baseRef: string, headRef: string, output: string) {
  const base = git(["rev-parse", "--verify", `${baseRef}^{commit}`]);
  const head = git(["rev-parse", "--verify", `${headRef}^{commit}`]);
  const mergeBase = git(["merge-base", base, head]);
  const files = git(["diff", "--name-only", "-z", mergeBase, head]).split("\0").filter(Boolean);
  const generated = files.filter(file => file.includes("/_generated/") || file.startsWith("apps/web/convex/"));
  const sources = files.filter(file => !generated.includes(file));
  const diff = git(["diff", "--no-ext-diff", "--no-textconv", mergeBase, head, "--", ".", ":(exclude)bun.lock", ":(exclude)apps/web/confect/_generated", ":(exclude)apps/web/convex"]);
  const commands = ["bun run validate core", "bun run validate fuzz --seed 20260918 --runs 60"];
  if (files.some(file => /components|hooks|planning|capture|validation/.test(file))) commands.push("bun run validate browser", "bun run probe:browser --plan output/plan.json");
  if (files.some(file => /confect|schema|mobile/.test(file))) commands.push("bun run probe:performance --sizes 50,500,2000");
  const manifest = {
    version: 1, base, head, mergeBase, sourceFiles: sources, generatedFiles: generated,
    diffSha256: createHash("sha256").update(diff).digest("hex"),
    diffBytes: Buffer.byteLength(diff), diffFile: "change.diff", contextFile: "context.md",
    commands, instructions: ["AGENTS.md", "apps/web/confect/AGENTS.md", "docs/ARCHITECTURE.md", "docs/VALIDATION.md"],
  };
  await mkdir(output, { recursive: true });
  await Bun.write(resolve(output, "manifest.json"), JSON.stringify(manifest, null, 2));
  await Bun.write(resolve(output, "change.diff"), diff);
  const budget = 32_000;
  await Bun.write(resolve(output, "context.md"), `# Revision-bound review\n\nBase: ${base}\nHead: ${head}\nMerge base: ${mergeBase}\n\nRead manifest.json for the complete file list. Generated wrappers: ${generated.length}; sources: ${sources.length}. Source diff: ${Buffer.byteLength(diff)} bytes.\n\n${sources.slice(0, 100).map(file => `- ${file}`).join("\n")}\n${sources.length > 100 ? "Additional source paths are in manifest.json; none are silently excluded from review scope." : ""}\n\nFocused commands:\n${commands.map(command => `- \`${command}\``).join("\n")}\n\n${diff.length <= budget ? `\`\`\`diff\n${diff}\n\`\`\`` : "The source diff exceeds the prompt budget. Read change.diff in focused chunks; do not treat omitted inline context as reviewed."}\n`);
  return manifest;
}
if (import.meta.main) {
  const { values } = parseArgs({ args: Bun.argv.slice(2), options: { base: { type: "string", default: "origin/main" }, head: { type: "string", default: "HEAD" }, output: { type: "string", default: "output/review" } } });
  console.log(await buildContext(values.base!, values.head!, resolve(root, values.output!)));
}
