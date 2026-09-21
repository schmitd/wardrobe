import { expect, test } from "bun:test";
import { mkdtemp, mkdir, chmod, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

test("trusted publisher binds live main, rejects stale evidence and main movement", async () => {
  const root = await mkdtemp(join(tmpdir(), "wardrobe-publisher-probe-"));
  const head = "a".repeat(40), base = "b".repeat(40), stale = "c".repeat(40);
  try {
    await mkdir(join(root, "bin"));
    const fake = join(root, "bin/gh");
    await Bun.write(fake, `#!/usr/bin/env bun
const root = ${JSON.stringify(root)};
const args = Bun.argv.slice(2);
const file = Bun.file(root + "/calls.json");
const calls = await file.exists() ? await file.json() : [];
calls.push(args); await Bun.write(file, JSON.stringify(calls));
const route = args[1];
if (route?.endsWith("/pulls/99")) console.log(JSON.stringify({state:"open",draft:false,labels:[],base:{ref:"main",sha:"${stale}"},head:{sha:"${head}",repo:{full_name:"schmitd/wardrobe"}}}));
else if (route?.endsWith("/branches/main/protection")) console.log(JSON.stringify({required_status_checks:{strict:true,contexts:["Merge checks","Wardrobe adversarial"]},enforce_admins:{enabled:true}}));
else if (route?.endsWith("/branches/main")) console.log(JSON.stringify({commit:{sha:process.env.PROBE_MOVE_MAIN === "1" && calls.filter(a=>a[1]?.endsWith("/branches/main")).length>1 ? "${stale}" : "${base}"}}));
else console.log("{}");
`);
    await chmod(fake, 0o700);
    async function run(reportBase: string, move: boolean) {
      await Bun.write(join(root, "calls.json"), "[]");
      await Bun.write(join(root, "report.json"), JSON.stringify({ base: reportBase, head, verdict: "pass", summary: "Synthetic independent pass", findings: [], decisions: [], coverageGaps: [], commands: [{command:"synthetic probe",exitCode:0,artifact:"synthetic.log"}] }));
      const child = Bun.spawn(["bun", resolve(import.meta.dir, "../../scripts/review-merge.ts"), "--pr", "99", "--report", join(root,"report.json"), "--apply"], {env:{...process.env,PATH:`${join(root,"bin")}:${process.env.PATH}`,PROBE_MOVE_MAIN:move?"1":"0"},stdout:"pipe",stderr:"pipe"});
      const [code, out, err] = await Promise.all([child.exited,new Response(child.stdout).text(),new Response(child.stderr).text()]);
      const calls = await Bun.file(join(root,"calls.json")).json() as string[][];
      return {code,out,err,published:calls.some(a=>a.includes("POST")),merged:calls.some(a=>a[0]==="pr"&&a[1]==="merge")};
    }
    const valid = await run(base,false); expect(valid.code).toBe(0); expect(valid.published&&valid.merged).toBe(true);
    const outdated = await run(stale,false); expect(outdated.code).not.toBe(0); expect(outdated.published||outdated.merged).toBe(false);
    const moved = await run(base,true); expect(moved.code).not.toBe(0); expect(moved.published||moved.merged).toBe(false);
  } finally { await rm(root,{recursive:true,force:true}); }
});
