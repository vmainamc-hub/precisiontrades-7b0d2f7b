// APEX SENTINEL — CELL IDENTITY AS A RANKING INPUT — real ranking-path tests.
//
// These exercise the ACTUAL buildFinalRank() path (identity spec §16/§17/§27):
// identity enters the ONE authoritative ranking at tier 2b (structural
// identity failure) and tier 5b (graded conformance strength). It is never a
// second ranking, never qualification, and UNKNOWN is never a pass.
// Unit tests for the identity layer itself live in
// ../sentinel/observation/cellIdentity.test.ts.

import { describe, it, expect } from "vitest";
import { buildFinalRank, candidateKey, candidateIdentityEvidence } from "./final-rank";
import type { IdentityConformanceLabel } from "../sentinel/observation/cellIdentity";

type AnyCandidate = any;

function intel(symbol: string, overrides: Partial<AnyCandidate> = {}): AnyCandidate {
  return {
    symbol,
    name: symbol,
    ticks: 1000,
    lastTickAt: Date.now() - 500,
    dataState: "ROBUST",
    danger: 20,
    entryClearance: { score: 90, verdict: "CLEARED", executionReady: true },
    ...overrides,
  };
}

function conformance(
  label: IdentityConformanceLabel,
  opts: { hardBlocked?: boolean } = {},
): AnyCandidate {
  return {
    proposition: { id: "over2", label: "Over 2" },
    greenPass: label === "FULL" || label === "STRONG",
    secondGreenPass: label === "FULL",
    redPass: label !== "FAILED",
    secondRedPass: label === "FULL",
    mostIncreasingSupportsIdentity: label !== "FAILED",
    mostDecreasingSupportsIdentity: label !== "FAILED",
    edgeGroupPass: label !== "FAILED",
    paceGroupPass: label !== "FAILED",
    greenDecayPass: label !== "FAILED",
    extremeDigitDecayPass: null,
    stabilityWatch: label === "FAILED" ? "RAPIDLY_INCREASING" : "STABLE",
    edgeGroupAvgPct: 11.25,
    hardBlocked: opts.hardBlocked ?? false,
    label,
    explanation: [`identity conformance ${label}`],
  };
}

/**
 * A fully-qualified, Stage-4-cleared candidate. `identity` controls the
 * dossier's identity evidence: a label, a hard block, or `null` for the
 * UNKNOWN case (dossier present but no conformance) / `"none"` for no dossier.
 */
function candidate(
  symbol: string,
  opts: {
    score?: number;
    psychologyScore?: number;
    identity?: IdentityConformanceLabel | null | "none";
    hardBlocked?: boolean;
    structuralFail?: boolean;
    dangerTotal?: number;
  } = {},
): AnyCandidate {
  const danger = opts.dangerTotal ?? 15;
  const identityConformance =
    opts.identity && opts.identity !== "none"
      ? conformance(opts.identity, { hardBlocked: opts.hardBlocked })
      : opts.hardBlocked
        ? conformance("PARTIAL", { hardBlocked: true })
        : null;

  return {
    symbol,
    name: symbol,
    score: opts.score ?? 75,
    agreement: "NEUTRAL",
    finalDecision: { verdict: "CLEARED", summary: "Cleared" },
    executionReady: true,
    danger,
    dangerComposition: { total: danger, level: "LOW", isHardBlocked: false },
    digitPsychology: {
      score: opts.psychologyScore ?? 70,
      verdict: "SUPPORT",
      redSemantics: { mandatoryRedStructureFailed: Boolean(opts.structuralFail) },
    },
    contract: { id: "over2", label: "Over 2", danger, fakeEdge: { verdict: "VALIDATED" } },
    ...(opts.identity === "none"
      ? {}
      : {
          dossier: {
            cellId: `${symbol}:over2`,
            identityConformance,
            pressure: { raw: { winPressure: { measurable: false }, losePressure: { measurable: false } } },
          },
        }),
    intel: intel(symbol),
    entryClearance: { score: 90, verdict: "CLEARED", executionReady: true },
    clearance: { verdict: "CLEARED", cleared: true },
  };
}

describe("buildFinalRank — cell identity as a ranking input (real ranking path)", () => {
  it("H — a FAILED identity never outranks an identity-coherent cell on generic score alone", () => {
    const broken = candidate("R_BROKEN", { identity: "FAILED", score: 95, psychologyScore: 90 });
    const coherent = candidate("R_COHERENT", { identity: "DEVELOPING", score: 60, psychologyScore: 60 });

    const { finalRank } = buildFinalRank([broken, coherent]);
    expect(candidateKey(finalRank[0])).toBe(candidateKey(coherent));
    expect(finalRank.map(candidateKey)).toContain(candidateKey(broken));
  });

  it("H2 — an explicit identity hard block behaves as a structural identity failure", () => {
    const blocked = candidate("R_BLOCKED", { identity: "STRONG", hardBlocked: true, score: 95 });
    const clean = candidate("R_CLEAN", { identity: "WEAK", score: 55 });

    const { finalRank } = buildFinalRank([blocked, clean]);
    expect(candidateKey(finalRank[0])).toBe(candidateKey(clean));
  });

  it("I — UNKNOWN identity is neither a pass nor a failure (no dossier, and dossier without conformance)", () => {
    const noDossier = candidate("R_NODOSSIER", { identity: "none", score: 90 });
    const noConformance = candidate("R_NOCONFORMANCE", { identity: null, score: 80 });
    const known = candidate("R_KNOWN", { identity: "FULL", score: 70 });

    expect(candidateIdentityEvidence(noDossier)).toBeNull();
    expect(candidateIdentityEvidence(noConformance)?.identityConformance).toBeNull();

    // UNKNOWN is not demoted like a failure: the higher-scored unknown cells
    // keep their ordering by score, and FULL identity does not promote past
    // them because tier 5b only compares candidates that BOTH have evidence.
    const { finalRank } = buildFinalRank([known, noConformance, noDossier]);
    expect(finalRank.map(candidateKey)).toEqual([
      candidateKey(noDossier),
      candidateKey(noConformance),
      candidateKey(known),
    ]);
  });

  it("J — graded conformance strength decides only between otherwise tied candidates", () => {
    const strong = candidate("A", { identity: "FULL", score: 75, psychologyScore: 70 });
    const weak = candidate("B", { identity: "WEAK", score: 75, psychologyScore: 70 });

    const { finalRank } = buildFinalRank([weak, strong]);
    expect(candidateKey(finalRank[0])).toBe(candidateKey(strong));
  });

  it("J2 — graded Confluence still outranks identity conformance strength", () => {
    // Identity conformance is tier 5b — strictly BELOW graded Confluence
    // (tier 5). When Confluence separates two candidates, a stronger identity
    // cannot promote the weaker-Confluence candidate.
    const strongerConfluenceWeakIdentity = candidate("A", { identity: "WEAK", score: 75, psychologyScore: 90 });
    const weakerConfluenceFullIdentity = candidate("B", { identity: "FULL", score: 75, psychologyScore: 40 });

    const { finalRank } = buildFinalRank([weakerConfluenceFullIdentity, strongerConfluenceWeakIdentity]);
    expect(candidateKey(finalRank[0])).toBe(candidateKey(strongerConfluenceWeakIdentity));
  });

  it("K — identity never overrides the mandatory RED structural veto or qualification", () => {
    const fullIdentityButVetoed = candidate("R_VETO", {
      identity: "FULL",
      score: 95,
      structuralFail: true,
    });
    const weakIdentityClean = candidate("R_CLEAN", { identity: "WEAK", score: 50 });

    const { finalRank } = buildFinalRank([fullIdentityButVetoed, weakIdentityClean]);
    expect(candidateKey(finalRank[0])).toBe(candidateKey(weakIdentityClean));

    // Qualification (tier 3) also outranks identity strength (tier 5b).
    const fullIdentityUnqualified = candidate("R_TOP", { identity: "FULL", score: 92 });
    fullIdentityUnqualified.intel = intel("R_TOP", { ticks: 5, dataState: "THIN" });
    fullIdentityUnqualified.executionReady = false;
    const weakQualified = candidate("R_LOW", { identity: "WEAK", score: 55 });

    const result = buildFinalRank([fullIdentityUnqualified, weakQualified]);
    expect(candidateKey(result.finalRank[0])).toBe(candidateKey(weakQualified));
    expect(
      result.entries.find((e) => candidateKey(e.candidate) === candidateKey(fullIdentityUnqualified))?.qualified,
    ).toBe(false);
  });

  it("L — identity evidence is stamped on every ranked candidate for display only", () => {
    const a = candidate("A", { identity: "STRONG", score: 80 });
    const b = candidate("B", { identity: "FAILED", score: 70 });
    const c = candidate("C", { identity: "none", score: 60 });

    const { finalRank } = buildFinalRank([c, b, a]);
    expect(finalRank.map((r: AnyCandidate) => r.rank)).toEqual([1, 2, 3]);
    for (const ranked of finalRank as AnyCandidate[]) {
      expect("identityEvidence" in ranked).toBe(true);
    }
    const stampedA = (finalRank as AnyCandidate[]).find((r) => candidateKey(r) === candidateKey(a));
    expect(stampedA.identityEvidence.identityConformance.label).toBe("STRONG");
    expect(stampedA.identityEvidence.positiveSignals.length).toBeGreaterThan(0);
    const stampedC = (finalRank as AnyCandidate[]).find((r) => candidateKey(r) === candidateKey(c));
    expect(stampedC.identityEvidence).toBeNull();
  });

  it("M — the ranking stays a single deterministic list: every candidate once, contiguous ranks, stable order", () => {
    const inputs = [
      candidate("A", { identity: "FAILED", score: 99 }),
      candidate("B", { identity: "FULL", score: 70 }),
      candidate("C", { identity: null, score: 70 }),
      candidate("D", { identity: "PARTIAL", score: 70 }),
    ];

    const first = buildFinalRank(inputs.map((c) => ({ ...c })));
    const second = buildFinalRank([...inputs].reverse().map((c) => ({ ...c })));

    expect(first.finalRank).toHaveLength(4);
    expect(first.finalRank.map((r: AnyCandidate) => r.rank)).toEqual([1, 2, 3, 4]);
    expect(new Set(first.finalRank.map(candidateKey)).size).toBe(4);
    expect(second.finalRank.map(candidateKey)).toEqual(first.finalRank.map(candidateKey));
    // The structurally failed identity is last, not deleted.
    expect(candidateKey(first.finalRank[3])).toBe("A:over2");
  });
});
