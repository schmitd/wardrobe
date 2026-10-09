import { resolve } from "node:path";

// Bun module mocks and DOM globals persist between files. Isolate component
// suites so they cannot replace real server actions in the backend tests.
const cwd = resolve(import.meta.dir, "..");
const files = [...new Bun.Glob("{src,confect,scripts,validation}/**/*.test.{ts,tsx}").scanSync({ cwd })].sort();
const components = files.filter(file => file.startsWith("src/components/") && file.endsWith(".tsx"));
const server = files.filter(file => !components.includes(file));
if (!server.length) throw new Error("No unit tests found");
for (const group of [...server, ...components].map(file => [file])) {
  const child = Bun.spawn(["bun", "test", ...group.map(file => `./${file}`)], { cwd, env: process.env, stdout: "inherit", stderr: "inherit" });
  const code = await child.exited;
  if (code) process.exit(code);
}
