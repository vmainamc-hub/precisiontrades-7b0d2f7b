/**
 * Identity integration contract.
 *
 * This module deliberately DOES NOT rank candidates. It exposes the canonical
 * identity evidence that the repository's existing single final-rank engine
 * can consume. Lovable should wire this evidence into the existing final-rank
 * decision; it must not create a second ranking here.
 */
import type { ObservationDossier } from "./types";

export interface IdentityRankingEvidence {
  cellId: string;
  identityConformance: NonNullable<ObservationDossier["identityConformance"]> | null;
  /** True only when the identity layer has an explicit hard block. */
  hardBlocked: boolean;
  /** Ordered identity signal names for deterministic diagnostics/tie-breaking. */
  positiveSignals: readonly string[];
  negativeSignals: readonly string[];
}

export function getIdentityRankingEvidence(dossier: ObservationDossier): IdentityRankingEvidence {
  const c = dossier.identityConformance ?? null;
  if (!c) {
    return {
      cellId: dossier.cellId,
      identityConformance: null,
      hardBlocked: false,
      positiveSignals: [],
      negativeSignals: ["identity evidence unavailable"],
    };
  }

  const positiveSignals: string[] = [];
  const negativeSignals: string[] = [];
  const add = (ok: boolean | null, positive: string, negative: string) => {
    if (ok === true) positiveSignals.push(positive);
    else if (ok === false) negativeSignals.push(negative);
  };

  add(c.greenPass, "GREEN identity-conforming", "GREEN identity conflict");
  add(c.secondGreenPass, "2ND GREEN identity-conforming", "2ND GREEN identity conflict");
  add(c.redPass, "RED identity-conforming", "RED identity conflict");
  add(c.secondRedPass, "2ND RED identity-conforming", "2ND RED identity conflict");
  add(c.mostIncreasingSupportsIdentity, "most-increasing digit supports winning side", "most-increasing digit conflicts with winning side");
  add(c.mostDecreasingSupportsIdentity, "most-decreasing digit supports losing-side release", "most-decreasing digit does not support losing-side release");
  add(c.edgeGroupPass, "edge-group suppression/rise pattern satisfied", "edge-group suppression/rise pattern failed");
  add(c.paceGroupPass, "pace-group momentum supports identity", "pace-group momentum conflicts with identity");
  add(c.greenDecayPass, "GREEN decay rule satisfied", "GREEN decay rule failed");
  add(c.extremeDigitDecayPass, "extreme-digit exhaustion pattern satisfied", "extreme-digit exhaustion pattern not satisfied");
  add(c.stabilityWatch === "STABLE" ? true : c.stabilityWatch === "UNKNOWN" ? null : false, "stability-watch digit stable", `stability-watch digit ${c.stabilityWatch.toLowerCase()}`);

  if (c.edgeGroupAvgPct !== null) {
    positiveSignals.push(`edge-group average ${c.edgeGroupAvgPct.toFixed(2)}%`);
  }

  return {
    cellId: dossier.cellId,
    identityConformance: c,
    hardBlocked: c.hardBlocked,
    positiveSignals,
    negativeSignals,
  };
}
