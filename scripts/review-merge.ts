import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { mergeReadiness } from "./review-policy";

// Run this publisher ONLY from the trusted, installed validation checkout.
// Never run a publisher loaded from the candidate PR or a downloaded CI artifact.
const { values } = parseArgs({ args: Bun.argv.slice(2), options: { pr: { type: "string" }, report: { type: "string" }, apply: { type: "boolean", default: false } } });
if (!values.pr || !/^\d+$/.test(values.pr) || !values.report) throw new Error("Usage: bun run review:merge --pr NUMBER --report PATH [--apply]");
const repo = "schmitd/wardrobe";
function gh(args: string[], input?: string) {
  const result = Bun.spawnSync(["gh", ...args], { stdin: input ? new TextEncoder().encode(input) : undefined });
  if (result.exitCode) throw new Error(result.stderr.toString());
  return result.stdout.toString();
}
const pr = JSON.parse(gh(["api", `repos/${repo}/pulls/${values.pr}`]));
if (pr.state !== "open" || pr.draft || pr.base.ref !== "main" || pr.head.repo?.full_name !== repo) throw new Error("Only ready, same-repository PRs targeting main are eligible; forks need an isolated maintainer review");
if (pr.labels.some((label: { name: string }) => ["needs-decision", "do-not-merge"].includes(label.name))) throw new Error("PR is on hold");
const reportFile = Bun.file(resolve(values.report));
if (reportFile.size > 256_000) throw new Error("Report too large");
const report = mergeReadiness(await reportFile.json(), pr.base.sha, pr.head.sha);
// A changed review workflow cannot grant itself permission to publish a pass.
console.log(JSON.stringify({ pr: values.pr, base: pr.base.sha, head: pr.head.sha, summary: report.summary, apply: values.apply }, null, 2));
if (values.apply) {
  // Native protections enforce CI and an up-to-date branch even if CI is still running.
  const protection = JSON.parse(gh(["api", `repos/${repo}/branches/main/protection`]));
  const contexts = protection.required_status_checks?.contexts ?? [];
  if (!protection.required_status_checks?.strict || !contexts.includes("Merge checks") || !contexts.includes("Wardrobe adversarial") || !protection.enforce_admins?.enabled) throw new Error("Required CI/review protections are not installed");
  const current = JSON.parse(gh(["api", `repos/${repo}/pulls/${values.pr}`]));
  if (current.head.sha !== pr.head.sha || current.base.sha !== pr.base.sha || current.draft || current.state !== "open" || current.labels.some((label: { name: string }) => ["needs-decision", "do-not-merge"].includes(label.name))) throw new Error("PR changed while preparing the attestation");
  gh(["api", "--method", "POST", `repos/${repo}/statuses/${pr.head.sha}`, "--input", "-"], JSON.stringify({ state: "success", context: "Wardrobe adversarial", description: "Codex review and targeted probes passed for this revision" }));
  gh(["pr", "merge", values.pr, "--repo", repo, "--auto", "--squash", "--match-head-commit", pr.head.sha]);
}
