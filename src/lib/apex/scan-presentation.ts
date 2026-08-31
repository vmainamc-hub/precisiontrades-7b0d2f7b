import type { RankedOpportunity, ScanResult } from "./types";

/**
 * SINGLE RANK #1 — the one and only candidate the Scan presentation layer may
 * display. It is always `finalRank[0]` of the current scan: never the first
 * qualified/tradeable cell, never an alerted cell, never a re-sorted subset.
 *
 * Qualification decides whether Rank #1 can EXECUTE — it never decides WHO
 * Rank #1 is. When `finalRank[0]` is unqualified/blocked it is still the
 * displayed candidate, with its blockers.
 *
 * Before the first scan there is no authoritative scan ranking, so the live
 * ranked field's leader is shown as a preview.
 */
export function selectScanCandidate(
  scan: ScanResult | null | undefined,
  liveRanked: readonly RankedOpportunity[] = [],
): RankedOpportunity | null {
  if (scan) {
    return scan.finalRank?.[0] ?? scan.bestOf90?.candidate ?? scan.best ?? null;
  }
  return liveRanked[0] ?? null;
}
