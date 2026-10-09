/** Remove transport references from both new recommendations and legacy stored prose. */
export function outfitText(text: string, references: readonly string[] = []): string {
  let safe = text;
  for (const id of [...new Set(references)].sort((a, b) => b.length - a.length)) {
    if (!id) continue;
    const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    safe = safe.replace(new RegExp(`\\s*\\(\\s*${escaped}\\s*\\)`, "g"), "");
    safe = safe.replace(new RegExp(`\\b${escaped}\\b`, "g"), "");
  }
  // Convex IDs and UUIDs can survive in stored prose after an item is removed.
  safe = safe.replace(/\b(?=[a-z0-9]{32}\b)(?=[a-z0-9]*\d)[a-z0-9]{32}\b/gi, "")
    .replace(/\b[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\b/gi, "")
    .replace(/\bpiece_\d+\b/g, "")
    .replace(/\(\s*\)/g, "").replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([,.;:])/g, "$1").trim();
  return safe;
}
