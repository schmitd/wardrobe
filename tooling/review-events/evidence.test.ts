import { expect, test } from "bun:test";
import { mkdtemp, mkdir, rm, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { finishReviewWorkspace, finishAuthorWorkspace } from "./evidence";
import { command } from "./commands";

test("review cleanup retains probe output without retaining installed dependencies", async () => {
  const root = await mkdtemp(join(tmpdir(), "wardrobe-review-cleanup-"));
  try {
    const workspace = join(root, "candidate"), evidence = join(root, "evidence");
    await mkdir(join(workspace, "output/review"), { recursive: true });
    await mkdir(join(workspace, "node_modules"));
    await Bun.write(join(workspace, "output/review/probe.json"), '{"passed":true}');
    await Bun.write(join(workspace, "node_modules/large-install"), new Uint8Array(1024 * 1024));
    await finishReviewWorkspace(workspace, evidence);
    expect(await Bun.file(join(evidence, "workspace-output/review/probe.json")).json()).toEqual({ passed: true });
    expect(await Bun.file(join(evidence, "node_modules/large-install")).exists()).toBe(false);
    expect(await access(workspace).then(() => true, () => false)).toBe(false);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("author cleanup retains changes relative to the original revision even after a local commit", async () => {
  const root = await mkdtemp(join(tmpdir(), "wardrobe-author-cleanup-"));
  try {
    const repo = join(root, "repo"), worktree = join(root, "author"), evidence = join(root, "evidence");
    await mkdir(repo); await command(["git", "init", "--quiet"], repo);
    await command(["git", "config", "user.email", "test@localhost"], repo); await command(["git", "config", "user.name", "Test"], repo);
    await Bun.write(join(repo, "source.txt"), "before\n"); await command(["git", "add", "."], repo);
    await command(["git", "-c", "commit.gpgsign=false", "commit", "-qm", "Baseline"], repo);
    const head = (await command(["git", "rev-parse", "HEAD"], repo)).trim();
    await command(["git", "worktree", "add", "--detach", worktree, head], repo);
    await Bun.write(join(worktree, "source.txt"), "after\n"); await command(["git", "add", "."], worktree);
    await command(["git", "-c", "commit.gpgsign=false", "commit", "-qm", "Local fix"], worktree);
    await Bun.write(join(worktree, "new-test.txt"), "untracked regression\n");
    await finishAuthorWorkspace(worktree, evidence, repo, head);
    expect(await Bun.file(join(evidence, "author.patch")).text()).toContain("+after");
    expect(await Bun.file(join(evidence, "author-untracked/new-test.txt")).text()).toContain("untracked regression");
    expect(await access(worktree).then(() => true, () => false)).toBe(false);
    expect(await command(["git", "worktree", "list"], repo)).not.toContain(worktree);
  } finally { await rm(root, { recursive: true, force: true }); }
});
