export type ReviewReport = {
  base: string; head: string; verdict: "pass" | "findings" | "needs_decision" | "incomplete";
  summary: string; findings: string[]; decisions: string[]; coverageGaps: string[];
  commands: { command: string; exitCode: number; artifact: string }[];
};
// This validates a trusted operator's attestation, not arbitrary PR-authored JSON.
export function mergeReadiness(value: unknown, base: string, head: string): ReviewReport {
  const report = value as ReviewReport | null;
  if (!report || !/^[a-f0-9]{40}$/.test(head) || !/^[a-f0-9]{40}$/.test(base) || report.head !== head || report.base !== base) throw new Error("Review does not match the current base and head");
  if (report.verdict !== "pass" || typeof report.summary !== "string" || !report.summary.trim()) throw new Error("Review is not a completed pass");
  for (const key of ["findings", "decisions", "coverageGaps"] as const) if (!Array.isArray(report[key]) || report[key].length) throw new Error(`Review has unresolved ${key}`);
  if (!Array.isArray(report.commands) || !report.commands.length || report.commands.some(command => !command || command.exitCode !== 0 || typeof command.command !== "string" || !command.command.trim() || typeof command.artifact !== "string" || !command.artifact.trim())) throw new Error("Review lacks successful commands and evidence references");
  return report;
}
