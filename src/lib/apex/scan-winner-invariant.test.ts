import { describe, it, expect } from "vitest";
import { selectScanCandidate } from "@/lib/apex/scan-presentation";
import { apexCore } from "@/lib/apex/core";
import { derivBus } from "@/lib/deriv/tick-bus";
import { rankOpportunities, DEFAULT_SCAN_OPTIONS, scanNow } from "@/lib/apex/scan";
import type { RankedOpportunity, ScanResult } from "@/lib/apex/types";

/**
 * FINAL SCAN WINNER CONTRACT
 * The candidate presented by Scan is ALWAYS finalRank[0]. Qualification decides
 * whether Rank #1 can execute — never who Rank #1 is.
 */

function cell(
  symbol: string,
  opts: {
    qualified: boolean;
    score: number;
    conformance?: string;
    danger?: number;
  },
): RankedOpportunity {
  return {
    symbol,
    name: symbol,
    score: opts.score,
    rank: 0,
    blocked: !opts.qualified,
    executionReady: opts.qualified,
    executionReadyReasons: [],
    contract: {
      id: `${symbol}-C`,
      label: `${symbol} contract`,
      confidence: opts.score,
      edge: 0.1,
      edgeLB: 0.05,
      quality: opts.score,
      stability: opts.score,
      freshness: 90,
      danger: opts.danger ?? 10,
      contradiction: 5,
      phase: "STABLE",
      n: 1000,
    },
    intel: { regime: { label: "TREND" } },
    identityConformance: { state: opts.conformance ?? "STRONG" },
    finalDecision: { verdict: opts.qualified ? "CLEARED" : "BLOCKED", summary: "test" },
    observationQualification: { qualified: opts.qualified },
  } as unknown as RankedOpportunity;
}

function fakeScan(finalRank: RankedOpportunity[], qualified: RankedOpportunity[]): ScanResult {
  return {
    scannedAt: Date.now(),
    marketsOnline: 1,
    marketsTotal: 1,
    evaluated: finalRank.length,
    globalDanger: 10,
    globalDangerLabel: "CALM",
    top: qualified,
    finalRank,
    bestOf90: finalRank[0] ? ({ candidate: finalRank[0] } as ScanResult["bestOf90"]) : null,
    best: finalRank[0] ?? null,
    rejected: [],
    verdict: qualified.length ? "OPPORTUNITY" : "NONE",
    message: "",
  } as ScanResult;
}

describe("Scan winner invariant — displayed candidate === finalRank[0]", () => {
  it("keeps unqualified Rank #1 and never promotes a qualified Rank #2", () => {
    const cellA = cell("CELL_A", { qualified: false, score: 88 });
    const cellB = cell("CELL_B", { qualified: true, score: 71 });
    const scan = fakeScan([cellA, cellB], [cellB]);

    const displayed = selectScanCandidate(scan, [cellB, cellA]);

    expect(displayed).toBe(cellA);
    expect(displayed).toBe(scan.finalRank![0]);
    expect(displayed!.symbol).toBe("CELL_A");
    // Displayed rank is #1 and its qualification status is NOT QUALIFIED.
    expect(scan.finalRank!.indexOf(displayed!)).toBe(0);
    expect(displayed!.executionReady).toBe(false);
    expect(displayed!.finalDecision?.verdict).toBe("BLOCKED");
  });

  it("still displays finalRank[0] when qualified.length === 0", () => {
    const cellA = cell("CELL_A", { qualified: false, score: 80 });
    const cellB = cell("CELL_B", { qualified: false, score: 60 });
    const scan = fakeScan([cellA, cellB], []);

    expect(scan.top.length).toBe(0);
    const displayed = selectScanCandidate(scan, []);
    expect(displayed).toBe(scan.finalRank![0]);
    expect(displayed!.symbol).toBe("CELL_A");
  });

  it("identity-conforming but unqualified Rank #1 is not replaced by a qualified Rank #2", () => {
    const cellA = cell("CELL_A", {
      qualified: false,
      score: 93,
      conformance: "STRONG",
      danger: 5,
    });
    const cellB = cell("CELL_B", { qualified: true, score: 64, conformance: "WEAK", danger: 40 });
    const scan = fakeScan([cellA, cellB], [cellB]);

    const displayed = selectScanCandidate(scan, [cellB, cellA]);
    expect(displayed!.symbol).toBe("CELL_A");
    expect(displayed!.identityConformance?.state).toBe("STRONG");
  });

  it("uses the live ranked leader only before the first scan", () => {
    const live = cell("LIVE", { qualified: true, score: 50 });
    expect(selectScanCandidate(null, [live])).toBe(live);
    expect(selectScanCandidate(null, [])).toBeNull();
  });
});

describe("Scan winner invariant — real scan pipeline", () => {
  it("scanNow exposes finalRank[0] as bestOf90.candidate and best", () => {
    const ticks: { t: number; price: number }[] = [];
    let price = 1000.5;
    const nowMs = Date.now();
    for (let i = 0; i < 1000; i++) {
      price += (Math.random() - 0.49) * 0.5;
      ticks.push({ t: nowMs - 1_000_000 + i * 1000, price });
    }
    apexCore.retain();
    derivBus.setBuffer("R_100", ticks);
    apexCore.analyse("R_100");
    const intels = apexCore.getAll();

    const opts = { ...DEFAULT_SCAN_OPTIONS, minTicks: 10 };
    // sanity: the ranking engine produces a population
    expect(rankOpportunities(intels, opts).ranked.length).toBeGreaterThan(0);

    const scan = scanNow(intels, opts, false);
    expect(scan.finalRank && scan.finalRank.length).toBeGreaterThan(0);
    const rank1 = scan.finalRank![0];

    expect(scan.bestOf90?.candidate).toBe(rank1);
    expect(scan.best).toBe(rank1);
    expect(selectScanCandidate(scan, [])).toBe(rank1);

    // Even if the qualified subset leads with a different cell, Rank #1 stands.
    if (scan.top.length > 0 && scan.top[0] !== rank1) {
      expect(selectScanCandidate(scan, [])).not.toBe(scan.top[0]);
    }
  });
});
