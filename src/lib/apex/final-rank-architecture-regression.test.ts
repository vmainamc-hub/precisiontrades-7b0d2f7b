import { describe, expect, it } from "vitest";
import { buildFinalRank, candidateKey } from "./final-rank";

type C = any;

function c(symbol: string, overrides: C = {}): C {
  return {
    symbol,
    name: symbol,
    score: 60,
    agreement: "NEUTRAL",
    danger: 35,
    contract: { id: "OVER2", label: "Over 2", danger: 35, fakeEdge: { verdict: "VALIDATED" } },
    intel: { symbol, ticks: 1000, dataState: "ROBUST", ageMs: 0, danger: 35, entryClearance: { verdict: "CLEARED", executionReady: true } },
    executionReady: true,
    entryClearance: { verdict: "CLEARED", executionReady: true },
    clearance: { verdict: "CLEARED", cleared: true },
    finalDecision: { verdict: "CLEARED", summary: "Cleared" },
    digitPsychology: { score: 70, verdict: "SUPPORT", redSemantics: { mandatoryRedStructureFailed: false } },
    dossier: {
      cellId: `${symbol}:OVER2`,
      identityConformance: {
        proposition: "OVER2", greenPass: true, secondGreenPass: true, redPass: true, secondRedPass: true,
        mostIncreasingSupportsIdentity: true, mostDecreasingSupportsIdentity: true, edgeGroupPass: true,
        paceGroupPass: true, greenDecayPass: true, extremeDigitDecayPass: true, stabilityWatch: "STABLE",
        edgeGroupAvgPct: 8, hardBlocked: false, label: "FULL", explanation: [],
      },
      pressure: { raw: {
        winPressure: { measurable: true, ratePp: 3, persistence: 1, monotonicUp: true, agreement: "4/4" },
        losePressure: { measurable: true, ratePp: -3, persistence: 1, monotonicDown: true, agreement: "4/4" },
      } },
    },
    ...overrides,
  };
}

describe("single authoritative ranking architecture", () => {
  it("keeps the strongest complete opportunity at Rank #1 even when that candidate is execution-unqualified", () => {
    const a = c("A", {
      score: 95, psychologyScore: 88, agreement: "SUPPORT", danger: 8,
      intel: { symbol: "A", ticks: 5, dataState: "THIN", ageMs: 0, danger: 8, entryClearance: { verdict: "WAIT", executionReady: false } },
      executionReady: false, entryClearance: { verdict: "WAIT", executionReady: false }, clearance: { verdict: "WAIT", cleared: false },
      digitPsychology: { score: 88, verdict: "SUPPORT", redSemantics: { mandatoryRedStructureFailed: false } },
    });
    const b = c("B", { score: 65, psychologyScore: 55, agreement: "NEUTRAL", danger: 40 });
    const { finalRank, entries } = buildFinalRank([b, a]);
    expect(candidateKey(finalRank[0])).toBe("A:OVER2");
    expect(entries.find((e) => candidateKey(e.candidate) === "A:OVER2")?.qualified).toBe(false);
    expect(entries.find((e) => candidateKey(e.candidate) === "B:OVER2")?.qualified).toBe(true);
  });

  it("does not create a second winner from qualification", () => {
    const ranked = buildFinalRank([c("A", { score: 90 }), c("B", { score: 60 })]).finalRank;
    expect(ranked.filter((x: C) => x.rank === 1)).toHaveLength(1);
    expect(ranked[0].rank).toBe(1);
  });
});
