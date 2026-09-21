import { cp, mkdir, lstat, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { command } from "./commands";

async function exists(path: string): Promise<boolean> { try { await lstat(path); return true; } catch (error: any) { if (error.code === "ENOENT") return false; throw error; } }

// Preserve probes and source patches, not another copy of installed dependencies.
// Do not follow symlinks from the candidate into the host filesystem.
export async function preserveOutput(workspace: string, evidence: string) {
  await mkdir(evidence, { recursive: true, mode: 0o700 });
  if (await exists(resolve(workspace, "output"))) await cp(resolve(workspace, "output"), resolve(evidence, "workspace-output"), { recursive: true, dereference: false });
}

export async function finishReviewWorkspace(workspace: string, evidence: string) {
  await preserveOutput(workspace, evidence);
  await rm(workspace, { recursive: true, force: true });
}

export async function finishAuthorWorkspace(workspace: string, evidence: string, trustedRoot: string, originalHead: string) {
  await preserveOutput(workspace, evidence);
  await Bun.write(resolve(evidence, "author.patch"), await command(["git", "diff", "--binary", originalHead], workspace));
  const untracked = (await command(["git", "ls-files", "--others", "--exclude-standard", "-z"], workspace)).split("\0").filter(Boolean);
  for (const file of untracked) {
    const source = resolve(workspace, file);
    if (!source.startsWith(`${workspace}/`)) throw new Error("Invalid author evidence path");
    await cp(source, resolve(evidence, "author-untracked", file), { recursive: true, dereference: false });
  }
  await command(["git", "worktree", "remove", "--force", workspace], trustedRoot);
}
