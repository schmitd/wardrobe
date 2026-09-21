import { mock } from "bun:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Store } from "./store";
import { threadFingerprint, coversThreads as actualCoversThreads } from "./review";

const root = await mkdtemp(join(tmpdir(), "wardrobe-dispatch-probe-"));
const realGit = (args: string[]) => { const p = Bun.spawnSync(["git", ...args], { cwd: root }); if (p.exitCode) throw new Error(p.stderr.toString()); return p.stdout.toString().trim(); };
realGit(["init", "--quiet"]); realGit(["config", "user.name", "Synthetic probe"]); realGit(["config", "user.email", "probe@localhost"]);
await Bun.write(join(root, "source.txt"), "one"); realGit(["add", "."]); realGit(["-c", "commit.gpgsign=false", "commit", "-qm", "First"]);
const head = realGit(["rev-parse", "HEAD"]);
await Bun.write(join(root, "source.txt"), "two"); realGit(["add", "."]); realGit(["-c", "commit.gpgsign=false", "commit", "-qm", "Second"]);
const newer = realGit(["rev-parse", "HEAD"]);
let pr: any, report: any, feedback: any[], ci: string, reviewReady: boolean, duringReview: () => void, calls: string[], failReview: boolean, reviewSummary: string;
const clone = (v: any) => JSON.parse(JSON.stringify(v));
const thread = (id: string) => ({ id, path: "file.ts", comments: [] });
const disposition = (id: string) => ({ id, fingerprint: threadFingerprint(thread(id)), disposition: "fixed", reason: "verified source", evidence: "probe.log" });
function reset() {
  pr = { number: 99, state: "open", draft: false, merged: false, merge_commit_sha: null, labels: [], base: { ref: "main", sha: head }, head: { sha: head, ref: "candidate", repo: { full_name: "schmitd/wardrobe" } } };
  report = { base: head, head, verdict: "pass", summary: "Synthetic pass", findings: [], decisions: [], coverageGaps: [], commands: [{ command: "bun test", exitCode: 0, artifact: "probe.log" }], threads: [] };
  feedback = []; ci = "success"; reviewReady = true; duringReview = () => {}; calls = []; failReview = false; reviewSummary = "";
}
mock.module("./commands", () => ({
  cleanEnv: () => ({}),
  api: async (route: string) => {
    if (route.includes("/pulls/99")) return clone(pr);
    if (route.endsWith("/branches/main/protection")) return { required_status_checks: { strict: true, contexts: ["Merge checks", "Wardrobe adversarial"] }, enforce_admins: { enabled: true } };
    throw new Error(`Unexpected API ${route}`);
  },
  gh: async (args: string[]) => {
    const text = args.join(" ");
    if (text.includes("reviewThreads")) return { data: { repository: { pullRequest: { reviewThreads: { pageInfo: { hasNextPage: false }, nodes: feedback.map(t => ({ ...t, isResolved: false, comments: { pageInfo: { hasNextPage: false }, nodes: [] } })) } } } } };
    if (text.includes("resolveReviewThread")) { const id = args.find(a => a.startsWith("id="))!.slice(3); calls.push(`resolve:${id}`); feedback = feedback.filter(t => t.id !== id); return { data: {} }; }
    if (text.includes("/reviews?")) return [reviewReady ? [{ user: { login: "chatgpt-codex-connector[bot]" }, commit_id: pr.head.sha, state: "COMMENTED" }] : []];
    if (text.includes("/comments?")) return [reviewSummary ? [{user:{login:"chatgpt-codex-connector[bot]"},body:"<!-- codex-pull-request-review-summary -->\n"+reviewSummary}] : []];
    if (text.includes("/check-runs?")) return [{ check_runs: ci === "missing" ? [] : [{ name: "Merge checks", app: { slug: "github-actions" }, status: ci === "pending" ? "in_progress" : "completed", conclusion: ci }] }];
    if (text.startsWith("run list")) return [];
    throw new Error(`Unexpected gh ${text}`);
  },
  command: async (args: string[]) => {
    if (args[0] === "git") { if (args[1] === "rev-parse") return pr.head.sha; if (["fetch", "cat-file"].includes(args[1]!)) return ""; }
    if (args[0] === "bun" && args[1] === "scripts/review-merge.ts") { calls.push(args.includes("--apply") ? "publish" : "validate-report"); if (args.includes("--apply")) { pr.merged = true; pr.state = "closed"; pr.merge_commit_sha = newer; } return ""; }
    if (args[0] === "gh" && args.includes("context=Wardrobe adversarial")) { calls.push(args.find(a => a.startsWith("state="))!); return ""; }
    if (args[0] === "gh" && args.some(a => a.endsWith("/update-branch"))) { calls.push("update-branch"); assert(args.includes(`expected_head_sha=${head}`)); return ""; }
    throw new Error(`Unexpected command ${args.join(" ")}`);
  },
}));
mock.module("./review", () => ({ coversThreads: actualCoversThreads, independentReview: async () => { calls.push("review"); duringReview(); if (failReview) throw new Error("Synthetic subprocess failure"); return { report: clone(report), path: join(root, "report.json") }; } }));
mock.module("./author", () => ({ authorFix: async () => { calls.push("author"); return "pushed"; } }));
const { dispatch } = await import("./dispatch");
let count = 0;
async function run(setup: () => void, verify: (result: string) => void, trusted = true) {
  reset(); setup();
  const store = new Store(":memory:"); if (trusted) store.trust(99, head);
  const config = { port: 4920, secretFile: "/unused", stateDirectory: join(root, `state-${count}`), trustedRoot: root, trustedActors: ["schmitd"], execute: true };
  await mkdir(config.stateDirectory);
  try { let result: string; try { result = await dispatch({ kind: "pr", number: 99, head, trustHead: false, reason: "probe" }, config, store); } catch (e) { result = String(e); } verify(result); count++; }
  finally { store.close(); }
}
try {
  await run(() => {}, result => { assert(calls.includes("publish")); assert(result.includes(newer)); });
  await run(() => { ci = "pending"; }, result => { assert(!calls.includes("publish")); assert(result.includes("CI pending")); });
  await run(() => { ci = "missing"; }, result => { assert(!calls.includes("publish")); assert(result.includes("CI pending")); });
  await run(() => { ci = "failure"; }, result => { assert(!calls.includes("publish")); assert(calls.includes("state=failure")); });
  await run(() => { reviewReady = false; }, result => { assert(!calls.includes("publish")); assert(result.includes("waiting for GitHub")); });
  await run(() => { reviewReady = false; reviewSummary = "| Code Review | Completed | old-revision |"; }, () => { assert(calls.includes("publish")); });
  await run(() => { reviewSummary = "| Code Review | In progress | current-revision |"; }, result => { assert(!calls.includes("publish")); assert(result.includes("waiting for GitHub")); });
  await run(() => { reviewSummary = "| Code Review | Completed | old-revision |\n| Security Review | In progress | current-revision |"; }, () => { assert(!calls.includes("publish")); });
  await run(() => { feedback = [thread("known")]; report.threads = [disposition("known")]; }, () => { assert(calls.indexOf("resolve:known") < calls.indexOf("publish")); });
  await run(() => { duringReview = () => { feedback.push(thread("late")); }; }, () => { assert(!calls.includes("publish")); assert(!calls.some(c => c.startsWith("resolve:"))); });
  await run(() => { duringReview = () => { pr.head.sha = newer; }; }, result => { assert(!calls.includes("publish")); assert(result.includes("superseded")); });
  await run(() => { pr.labels = [{ name: "needs-decision" }]; }, () => { assert(!calls.includes("review")); assert(!calls.includes("publish")); });
  await run(() => {}, () => { assert(!calls.includes("review")); }, false);
  await run(() => { failReview = true; }, result => { assert(result.includes("Synthetic subprocess failure")); assert(calls.includes("state=failure")); assert(!calls.includes("publish")); });
  await run(() => { report.verdict = "incomplete"; report.findings = ["Confirmed ordinary bug"]; }, () => { assert(calls.includes("author")); assert(!calls.includes("publish")); });
  await run(() => { pr.base.sha = newer; }, result => { assert(calls.includes("update-branch")); assert(!calls.includes("review")); assert(result.includes("updating branch")); });
  console.log(`${count} controller scenarios passed`);
} finally { await rm(root, { recursive: true, force: true }); }
