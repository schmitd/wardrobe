import { resolve } from "node:path";
import { mkdir } from "node:fs/promises";
import { api, command } from "./commands";
import type { Config } from "./config";
import { REPOSITORY, type Event } from "./events";
import { eligible, protection, pull, threads, requiredCI, ciFailure, codexReviewCompleted, status, resolveThread, hold } from "./github";
import { independentReview, coversThreads, type Report } from "./review";
import { authorFix } from "./author";
import type { Store } from "./store";

export async function dispatch(event: Event, config: Config, store: Store): Promise<string> {
  const cwd = config.trustedRoot;
  let numbers: number[];
  if (event.kind === "pr" || event.kind === "feedback") numbers = [event.number];
  else if (event.kind === "ci") numbers = event.numbers.length ? event.numbers : (await api(`repos/${REPOSITORY}/commits/${event.head}/pulls`, cwd)).map((pr: any) => pr.number);
  else numbers = (await api(`repos/${REPOSITORY}/pulls?state=open&base=main&per_page=100`, cwd)).map((pr: any) => pr.number);
  const outcomes: string[] = [];
  const failures: string[] = [];
  for (const number of [...new Set(numbers)].slice(0, 100)) {
    let attemptedHead: string | undefined;
    try {
    let pr = await pull(number, cwd);
    if (!eligible(pr)) { if (pr.state === "closed") store.forget(number); outcomes.push(pr.merged ? `#${number}: merged ${pr.merge_commit_sha}` : `#${number}: not eligible`); continue; }
    if ((event.kind === "pr" || event.kind === "ci") && event.head !== pr.head.sha) { outcomes.push(`#${number}: stale event`); continue; }
    if ((event.kind === "pr" || event.kind === "ci") && event.trustHead) store.trust(number, event.head);
    if (!store.trusted(number, pr.head.sha)) { outcomes.push(`#${number}: head is not authorized for Desktop; requires isolated Cloud review`); continue; }
    if (!config.execute) { outcomes.push(`#${number}: audit-only, would review ${pr.head.sha}`); continue; }
    attemptedHead = pr.head.sha;
    await protection(cwd);
    await command(["git", "fetch", "origin", "main", `+pull/${number}/head:refs/review-events/pr-${number}`], cwd);
    if ((await command(["git", "rev-parse", `refs/review-events/pr-${number}`], cwd)).trim() !== pr.head.sha) { outcomes.push(`#${number}: changed during fetch`); continue; }
    const currentMain = (await command(["git", "rev-parse", "origin/main"], cwd)).trim();
    const ancestor = Bun.spawnSync(["git", "merge-base", "--is-ancestor", currentMain, pr.head.sha], { cwd });
    if (ancestor.exitCode === 1) {
      // GitHub performs a non-force update conditional on this exact head. Its
      // synchronize event triggers fresh CI and review for the merged revision.
      await command(["gh", "api", "--method", "PUT", `repos/${REPOSITORY}/pulls/${number}/update-branch`, "-f", `expected_head_sha=${pr.head.sha}`], cwd);
      outcomes.push(`#${number}: updating branch against current main`); continue;
    }
    if (ancestor.exitCode !== 0) throw new Error("Cannot establish current base ancestry");
    // The fetched branch, not cached PR metadata, binds this review.
    pr.base.sha = currentMain;
    await command(["git", "cat-file", "-e", `${pr.head.sha}:.github/workflows/ci.yml`], cwd);
    const output = resolve(config.stateDirectory, "reviews", `pr-${number}`, `${pr.base.sha}-${pr.head.sha}`);
    await mkdir(output, { recursive: true, mode: 0o700 });
    await status(pr.head.sha, "pending", "Independent review and dynamic probes are running", cwd);
    const feedback = await threads(number, cwd);
    const { report, path } = await independentReview(config, pr.base.sha, pr.head.sha, feedback, output);
    pr = await pull(number, cwd);
    if (!eligible(pr) || pr.head.sha !== report.head || pr.base.sha !== report.base || (await api(`repos/${REPOSITORY}/branches/main`, cwd)).commit.sha !== report.base) { outcomes.push(`#${number}: review superseded`); continue; }
    if (report.verdict === "needs_decision" || report.decisions.length) { await hold(number, pr.head.sha, cwd); outcomes.push(`#${number}: needs decision; ${path}`); continue; }
    if (report.findings.length) {
      const attempt = resolve(output, "author-result.json");
      if (await Bun.file(attempt).exists()) { outcomes.push(`#${number}: author already attempted this revision; inspect ${attempt}`); continue; }
      await status(pr.head.sha, "pending", "Confirmed findings are being fixed in a separate author pass", cwd);
      const result = await authorFix(config, pr, report, feedback, output);
      if (result === "needs_decision") await hold(number, pr.head.sha, cwd);
      else if (result !== "pushed" && result !== "stale") await status(pr.head.sha, "failure", "Author pass could not complete; inspect private evidence", cwd);
      outcomes.push(`#${number}: author ${result}; next pushed revision gets a fresh review`);
      continue;
    }
    if (report.verdict !== "pass" || report.findings.length || report.coverageGaps.length || !coversThreads(report, feedback)) {
      await status(pr.head.sha, "failure", "Independent review has unresolved findings or coverage gaps", cwd);
      outcomes.push(`#${number}: review incomplete; ${path}`); continue;
    }
    const currentThreads = await threads(number, cwd);
    if (!coversThreads(report, currentThreads)) { outcomes.push(`#${number}: new GitHub feedback requires review`); continue; }
    await command(["bun", "scripts/review-merge.ts", "--pr", String(number), "--report", path], cwd, resolve(output, "attestation-check.log"));
    // Resolve only exact threads independently investigated at this unchanged revision.
    for (const thread of currentThreads) await resolveThread(thread.id, cwd);
    if (!await codexReviewCompleted(number, pr.head.sha, cwd)) { await status(pr.head.sha, "pending", "Independent review passed; waiting for GitHub Codex review", cwd); outcomes.push(`#${number}: waiting for GitHub review event`); continue; }
    const ci = await requiredCI(pr.head.sha, cwd);
    if (ci !== "passed") {
      await status(pr.head.sha, ci === "failed" ? "failure" : "pending", ci === "failed" ? "Independent review passed; required CI failed" : "Independent review passed; waiting for required CI completion", cwd);
      if (ci === "failed" && !await Bun.file(resolve(output, "ci-author/author-result.json")).exists()) {
        const failure = await ciFailure(pr.head.sha, cwd);
        if (failure) {
          const ciOutput = resolve(output, "ci-author"); await mkdir(ciOutput, { recursive: true });
          const ciReport: Report = { ...report, verdict: "findings", findings: [failure] };
          const result = await authorFix(config, pr, ciReport, [], ciOutput);
          if (result === "needs_decision") await hold(number, pr.head.sha, cwd);
          outcomes.push(`#${number}: CI author ${result}`); continue;
        }
      }
      outcomes.push(`#${number}: CI ${ci}; exact review evidence retained`); continue;
    }
    // Final metadata reads close races before the trusted publisher checks again.
    if ((await threads(number, cwd)).length) { outcomes.push(`#${number}: new unresolved feedback`); continue; }
    await command(["bun", "scripts/review-merge.ts", "--pr", String(number), "--report", path, "--apply"], cwd, resolve(output, "publish.log"));
    const after = await pull(number, cwd);
    const result = after.merged ? { outcome: "merged", pr: number, sha: after.merge_commit_sha } : { outcome: "auto_merge_requested", pr: number, head: pr.head.sha };
    await Bun.write(resolve(output, "publication.json"), JSON.stringify(result, null, 2));
    outcomes.push(JSON.stringify(result));
    } catch (error) {
      const detail = `#${number}: ${String(error)}`;
      failures.push(detail);
      // A failed subprocess must not masquerade indefinitely as a running review.
      // Never write an error onto a newer revision that superseded this attempt.
      if (attemptedHead) try {
        const current = await pull(number, cwd);
        if (eligible(current) && current.head.sha === attemptedHead) await status(attemptedHead, "failure", "Review execution failed; inspect private controller evidence", cwd);
      } catch { /* The durable failed event remains the fallback during API outages. */ }
    }
  }
  if (failures.length) throw new Error([...outcomes, ...failures].join("\n"));
  return outcomes.join("\n") || "No affected pull requests";
}
