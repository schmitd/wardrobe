import { mkdir, realpath } from "node:fs/promises";
import { relative, resolve, isAbsolute } from "node:path";

const within = (root: string, path: string) => {
  const suffix = relative(root, path);
  return suffix === "" || (suffix !== ".." && !suffix.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) && !isAbsolute(suffix));
};

export function resolvePrivateCaptureOutput(value: string, repositoryRoot: string, cwd = process.cwd()) {
  const directory = resolve(cwd, value);
  const roots = [resolve(repositoryRoot, "output"), resolve(repositoryRoot, "apps/web/output")];
  const root = roots.find(candidate => within(candidate, directory));
  if (!root) throw new Error("Private capture output must be inside the repository's ignored output directory");
  return { directory, root };
}

export async function preparePrivateCaptureOutput(value: string, repositoryRoot: string, cwd = process.cwd()) {
  const { directory, root } = resolvePrivateCaptureOutput(value, repositoryRoot, cwd);
  await mkdir(root, { recursive: true, mode: 0o700 });
  const canonicalRoot = await realpath(root);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const canonicalDirectory = await realpath(directory);
  if (canonicalRoot !== root || canonicalDirectory !== directory || !within(canonicalRoot, canonicalDirectory)) {
    throw new Error("Private capture output cannot follow directory symlinks");
  }
  return directory;
}
