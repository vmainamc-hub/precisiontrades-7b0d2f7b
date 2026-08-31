// APEX SENTINEL — SINGLE AUTHORITATIVE FINAL RANKING
//
// There is exactly ONE final ordering of the 90-cell universe, and exactly ONE
// Rank #1. Qualification (operator surface gate) and Stage 4 risk clearance are
// ranking INPUTS — they are never a second, competing ranking, and they never
// remove a candidate from the ranking. `finalRank[0]` is therefore always the
// Scan winner, qualified or not; when it is not qualified the UI shows it with
// honest blockers instead of substituting a different candidate.
//
// Ranking hierarchy (highest authority first):
//   1. Stage 4 final verdict precedence (CLEARED > HELD_* > WAIT > BLOCKED)
//   2. Mandatory RED structure integrity (structurally-failed never outranks valid)
//   2b. CELL IDENTITY structural failure — a cell whose permanent identity is
//      currently FAILED/hard-blocked never outranks an identity-coherent cell
//      (identity spec §16/§17). Unknown identity evidence is not a failure.
//   3. Number/quality of operator gates passed
//   4. Stage 4 state (risk/decision evidence, not a winner selector)
//   5. GRADED EMPIRICAL CONFLUENCE (confluence.ts) — chief ranking authority
//      among equals. Blends the existing 1,000-tick digit-psychology score
//      with 120-tick pressure alignment, engine agreement and danger safety,
//      so a candidate with strong *simultaneous* convergence across all four
//      empirical dimensions can outrank one with a higher psychology score
//      alone but weaker corroborating evidence. This is a graded ranking
//      enhancement, never a qualification gate (see confluence.ts) — it
//      cannot move a candidate across tiers 1-4 above, only reorder within
//      an otherwise-equal tier.
//   5b. Graded CELL IDENTITY conformance strength — separates candidates that
//      Confluence left tied; never crosses tiers 1-4.
//   6. Raw digit-psychology score — tiebreaker when Confluence scores tie
//      (preserves psychology as an authority in its own right, not merely a
//      Confluence input).
//   7. Raw opportunity score — last-resort tiebreaker.
//   8. Stable deterministic key tiebreaker (symbol:contract).
//
// No existing Sentinel mathematics is altered here: every input is read, never
// recomputed.

import type { MarketIntel, RankedOpportunity } from "./types";
import { operatorSurfaceGate, type OperatorSurfaceGateResult } from "./operator-surface-gate";
import { VERDICT_PRECEDENCE, candidateDigitPsychology } from "../sentinel/final-decision";
import { computeConfluenceCore, type ConfluenceCore } from "./confluence";
import {
  getIdentityRankingEvidence,
  type IdentityRankingEvidence,
} from "../sentinel/observation/identityIntegrationContract";
import type { IdentityConformanceLabel } from "../sentinel/observation/cellIdentity";
import type { FinalVerdict } from "../../types/sentinel";

// ── CELL IDENTITY AS A RANKING INPUT (identity spec §16/§17) ───────────────
//
// Identity is NOT a second ranking and NOT qualification. It enters the ONE
// authoritative ordering above at exactly two points:
//
//   Tier 2b — structural identity failure: a cell whose own identity is
//             FAILED / hard-blocked can never outrank a structurally coherent
//             cell, no matter how high its generic score.
//   Tier 5b — graded identity conformance strength, used only between
//             candidates already tied on every higher tier (including graded
//             Confluence), before the raw psychology/score tiebreakers.
//
// Missing identity evidence is UNKNOWN, never a pass (§27): a candidate with
// no conformance record is neither treated as failed nor as conforming — it
// simply skips the identity comparisons.

const IDENTITY_STRENGTH: Record<IdentityConformanceLabel, number> = {
  FAILED: 0,
  WEAK: 1,
  PARTIAL: 2,
  DEVELOPING: 3,
  STRONG: 4,
  FULL: 5,
};

/** Reads the identity evidence already attached to the observation dossier. */
export function candidateIdentityEvidence(candidate: unknown): IdentityRankingEvidence | null {
  const dossier =
    (candidate as any)?.dossier ?? (candidate as any)?.observationDossier ?? null;
  if (!dossier || typeof dossier.cellId !== "string") return null;
  return getIdentityRankingEvidence(dossier);
}

/** True only when the identity layer explicitly reports a broken identity. */
function identityStructurallyFailed(ev: IdentityRankingEvidence | null): boolean {
  if (!ev || !ev.identityConformance) return false; // UNKNOWN — never a failure, never a pass
  return ev.hardBlocked || ev.identityConformance.label === "FAILED";
}

/** 0..5 conformance strength, or null when identity evidence is unavailable. */
function identityStrength(ev: IdentityRankingEvidence | null): number | null {
  const label = ev?.identityConformance?.label;
  return label ? IDENTITY_STRENGTH[label] : null;
}


export interface FinalRankEntry<T> {
  candidate: T;
  gate: OperatorSurfaceGateResult;
  /** Passed the operator surface gate AND Stage 4 returned CLEARED. */
  qualified: boolean;
  blockers: string[];
}

export function candidateKey(c: any): string {
  return `${c?.symbol ?? c?.market ?? "?"}:${c?.contract?.id ?? c?.contractId ?? c?.id ?? "?"}`;
}

function gatesPassed(gate: OperatorSurfaceGateResult): number {
  return Object.values(gate.gateResults).filter(Boolean).length;
}

/** Operator qualification + Stage 4 clearance for a single candidate. */
export function evaluateQualification<T extends RankedOpportunity>(
  candidate: T,
  minScore?: number,
): FinalRankEntry<T> {
  const gate = operatorSurfaceGate(candidate, (candidate as any).intel as MarketIntel, {
    ...(minScore !== undefined ? { minScore } : {}),
  });
  const decision = (candidate as any).finalDecision;
  const stage4Cleared = decision?.verdict === "CLEARED";
  const blockers = [...gate.blockers];
  if (decision && !stage4Cleared && decision.summary && !blockers.includes(decision.summary)) {
    blockers.push(decision.summary);
  }
  return {
    candidate,
    gate,
    qualified: gate.qualified && stage4Cleared,
    blockers,
  };
}

/**
 * Produces the single authoritative ranking. Every input candidate appears
 * exactly once in the output, ranks are re-stamped 1..N, and the order is
 * deterministic for identical inputs.
 */
export function buildFinalRank<T extends RankedOpportunity>(
  candidates: T[],
  minScore?: number,
): { finalRank: T[]; entries: FinalRankEntry<T>[] } {
  const entries = candidates.map((c) => evaluateQualification(c, minScore));

  // GRADED EMPIRICAL CONFLUENCE computed once per candidate, up front, so the
  // comparator and the diagnostic stamp below always agree and nothing is
  // recomputed mid-sort. Keyed by the same stable candidateKey() used
  // elsewhere in this file.
  const confluenceByKey = new Map<string, ConfluenceCore>();
  for (const e of entries) {
    confluenceByKey.set(candidateKey(e.candidate), computeConfluenceCore(e.candidate));
  }
  const getConfluence = (candidate: unknown): ConfluenceCore =>
    confluenceByKey.get(candidateKey(candidate)) ?? computeConfluenceCore(candidate);

  // CELL IDENTITY evidence, read once per candidate from the dossier via the
  // supplied integration contract. Nothing is recomputed and nothing is
  // re-ranked here — this only exposes the evidence to the comparator below.
  const identityByKey = new Map<string, IdentityRankingEvidence | null>();
  for (const e of entries) {
    identityByKey.set(candidateKey(e.candidate), candidateIdentityEvidence(e.candidate));
  }
  const getIdentity = (candidate: unknown): IdentityRankingEvidence | null =>
    identityByKey.get(candidateKey(candidate)) ?? candidateIdentityEvidence(candidate);

  entries.sort((a, b) => {
    const psychA = candidateDigitPsychology(a.candidate);
    const psychB = candidateDigitPsychology(b.candidate);

    // TIER 1 — AUTHORITATIVE HARD STRUCTURAL VETOES.
    // These are genuine contradictions/unsafe states, not ordinary
    // qualification failures. They remain at the bottom of the single
    // ranking and can never be rescued by a high raw score.
    const redFailedA = Boolean(psychA?.redSemantics?.mandatoryRedStructureFailed);
    const redFailedB = Boolean(psychB?.redSemantics?.mandatoryRedStructureFailed);
    if (redFailedA !== redFailedB) return redFailedA ? 1 : -1;

    const idA = getIdentity(a.candidate);
    const idB = getIdentity(b.candidate);
    const idFailedA = identityStructurallyFailed(idA);
    const idFailedB = identityStructurallyFailed(idB);
    if (idFailedA !== idFailedB) return idFailedA ? 1 : -1;

    // TIER 3 — GRADED EMPIRICAL CONFLUENCE.
    // This is the strengthened psychology/pressure/engine-agreement/danger
    // ranking signal. It is deliberately evaluated BEFORE qualification so
    // an execution-ineligible candidate with the strongest complete
    // opportunity can still be the authoritative Rank #1.
    const confA = getConfluence(a.candidate);
    const confB = getConfluence(b.candidate);
    if (confA.measurable && confB.measurable && confA.score !== confB.score) {
      return confB.score - confA.score;
    }

    // TIER 4 — OPERATOR-GATE STATE.
    // Gate quality participates in the SAME ranking but is not converted into
    // a second "qualified candidates" ranking. Qualification is a status on
    // the already-ranked candidate, not a selector for Rank #1.
    const gpA = gatesPassed(a.gate);
    const gpB = gatesPassed(b.gate);
    if (gpA !== gpB) return gpB - gpA;


    // TIER 5 — STAGE 4 / FINAL-DECISION STATE.
    // Stage 4 remains part of complete-opportunity ordering. A genuinely
    // BLOCKED verdict is weaker than a non-blocked state, but ordinary
    // non-cleared states do not automatically leapfrog a stronger
    // psychology/confluence candidate.
    const va = VERDICT_PRECEDENCE[(a.candidate as any).finalDecision?.verdict as FinalVerdict] ?? 0;
    const vb = VERDICT_PRECEDENCE[(b.candidate as any).finalDecision?.verdict as FinalVerdict] ?? 0;
    const blockedA = (a.candidate as any).finalDecision?.verdict === "BLOCKED";
    const blockedB = (b.candidate as any).finalDecision?.verdict === "BLOCKED";
    if (blockedA !== blockedB) return blockedA ? 1 : -1;
    if (va !== vb) return vb - va;

    // TIER 5b — GRADED CELL-IDENTITY CONFORMANCE STRENGTH.
    // Separates candidates that every higher tier left tied. It is never
    // qualification and never crosses tiers 1-5. UNKNOWN evidence on either
    // side skips this comparison entirely (§27).
    const strA = identityStrength(idA);
    const strB = identityStrength(idB);
    if (strA !== null && strB !== null && strA !== strB) return strB - strA;


    // TIER 6 — RAW 1,000-TICK PSYCHOLOGY.
    const sA = psychA?.score ?? (a.candidate as any).psychologyScore ?? null;
    const sB = psychB?.score ?? (b.candidate as any).psychologyScore ?? null;
    if (sA !== null && sB !== null && sA !== sB) return sB - sA;

    // TIER 7 — RAW OPPORTUNITY SCORE.
    const rawA = (a.candidate as any).score ?? (a.candidate as any).opportunityScore ?? 0;
    const rawB = (b.candidate as any).score ?? (b.candidate as any).opportunityScore ?? 0;
    if (rawA !== rawB) return rawB - rawA;

    return candidateKey(a.candidate).localeCompare(candidateKey(b.candidate));
  });

  const finalRank = entries.map((e, index) => {
    const stamped = {
      ...(e.candidate as any),
      rank: index + 1,
      // Diagnostic transparency (§25 of the empirical-confluence spec): the
      // graded Confluence evidence rides along on the ranked candidate so the
      // UI can show it without recomputing anything.
      confluence: getConfluence(e.candidate),
      // Identity evidence rides along for the same reason (identity spec §14).
      // It is diagnostic output of the ONE ranking, not a second ranking.
      identityEvidence: getIdentity(e.candidate),
    } as T;
    e.candidate = stamped;
    return stamped;
  });


  return { finalRank, entries };
}
