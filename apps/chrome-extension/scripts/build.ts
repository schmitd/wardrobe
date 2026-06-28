import { mkdir, copyFile, rm } from "node:fs/promises";

const outdir = "dist";
await rm(outdir, { recursive: true, force: true });
await mkdir(outdir, { recursive: true });

await Bun.build({
  entrypoints: ["src/background.ts", "src/content.ts"],
  outdir,
  target: "browser",
  format: "esm",
});

await copyFile("manifest.json", `${outdir}/manifest.json`);
