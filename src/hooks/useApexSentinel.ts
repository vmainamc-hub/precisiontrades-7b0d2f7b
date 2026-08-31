// APEX SENTINEL — React binding to the continuous intelligence core.
// The core runs regardless of render cadence; this hook only samples it on a
// throttled interval so a busy engine can never stall the UI.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apexCore, APEX_UNIVERSE } from "@/lib/apex/core";
import {
  DEFAULT_SCAN_OPTIONS,
  globalDanger,
  rankOpportunities,
  scanNow,
  type ScanOptions,
} from "@/lib/apex/scan";
import type { MarketIntel, RankedOpportunity, ScanResult } from "@/lib/apex/types";
import { memoryStats } from "@/lib/apex/memory";
import { observationEngine, type ObservationEngineHealthReport } from "@/lib/sentinel/observation";

const UI_REFRESH_MS = 1000;

// ── Fail-safe thresholds ────────────────────────────────────────────────
/** Analysis output older than this means the engine is behind the feed. */
const ANALYSIS_LAG_MS = 6_000;
/** No tick for any market in this window means the feed itself is stale. */
const FEED_STALE_MS = 12_000;
/** A single UI sample taking longer than this means the engine is saturated. */
const ENGINE_BUSY_MS = 450;

export type ApexFailsafe = "ANALYSIS LAG" | "FEED STALE" | "ENGINE BUSY" | "BACKEND DEGRADED";

export interface ApexState {
  status: "idle" | "connecting" | "live" | "error";
  intels: MarketIntel[];
  ranked: RankedOpportunity[];
  online: number;
  total: number;
  globalDanger: number;
  globalDangerLabel: "CALM" | "ELEVATED" | "HOSTILE";
  memory: { states: number; observations: number; updatedAt: number };
  observationHealth: ObservationEngineHealthReport;
  scan: ScanResult | null;
  scanning: boolean;
  runScan: () => ScanResult;
  /** Active fail-safe warnings; empty when the pipeline is healthy. */
  failsafes: ApexFailsafe[];
  /** True when any fail-safe is active — signals output must not be trusted. */
  degraded: boolean;
}

export function useApexSentinel(options: ScanOptions = DEFAULT_SCAN_OPTIONS): ApexState {
  const [tick, setTick] = useState(0);
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [scanning, setScanning] = useState(false);
  const optsRef = useRef(options);
  optsRef.current = options;

  useEffect(() => {
    const unsub = apexCore.subscribe(() => {});
    const id = setInterval(() => setTick((t) => t + 1), UI_REFRESH_MS);
    setTick((t) => t + 1);
    return () => {
      clearInterval(id);
      unsub();
    };
  }, []);

  const sampleCostRef = useRef(0);

  const intels = useMemo(() => {
    const t0 = Date.now();
    const all = apexCore.getAll();
    sampleCostRef.current = Date.now() - t0;
    return all;
  }, [tick]);
  const ranked = useMemo(() => rankOpportunities(intels, optsRef.current).ranked, [intels]);
  const gd = useMemo(() => globalDanger(intels), [intels]);
  const memory = useMemo(() => memoryStats(), [tick]);
  const observationHealth = useMemo(() => observationEngine.getHealthStatus(), [tick]);

  const runScan = useCallback(() => {
    setScanning(true);
    const result = scanNow(apexCore.getAll(), optsRef.current);
    setScan(result);
    // Immediate by design: the state is already maintained continuously.
    setTimeout(() => setScanning(false), 220);
    return result;
  }, []);

  const status =
    apexCore.getStatus() === "live"
      ? ("live" as const)
      : apexCore.getStatus() === "connecting"
        ? ("connecting" as const)
        : apexCore.getStatus() === "error"
          ? ("error" as const)
          : ("idle" as const);

  const online = intels.filter((i) => i.dataState === "OK").length;

  // ── Fail-safe derivation ──────────────────────────────────────────────
  // These states never silently degrade the signal — the UI must show them so
  // an operator can tell "no opportunity" apart from "we cannot see".
  const failsafes = useMemo<ApexFailsafe[]>(() => {
    const flags: ApexFailsafe[] = [];
    const now = Date.now();
    const newestAnalysis = intels.reduce((a, i) => Math.max(a, i.updatedAt || 0), 0);
    const newestTick = intels.reduce((a, i) => Math.max(a, i.lastTickAt || 0), 0);

    if (status === "live" && newestAnalysis > 0 && now - newestAnalysis > ANALYSIS_LAG_MS) {
      flags.push("ANALYSIS LAG");
    }
    if (status === "live" && newestTick > 0 && now - newestTick > FEED_STALE_MS) {
      flags.push("FEED STALE");
    }
    if (sampleCostRef.current > ENGINE_BUSY_MS) {
      flags.push("ENGINE BUSY");
    }
    if (status === "error" || (status === "live" && online === 0 && intels.length > 0)) {
      flags.push("BACKEND DEGRADED");
    }
    return flags;
  }, [intels, status, online, tick]);

  return {
    status,
    intels,
    ranked,
    online,
    total: APEX_UNIVERSE.length,
    globalDanger: gd,
    globalDangerLabel: gd < 35 ? "CALM" : gd < 65 ? "ELEVATED" : "HOSTILE",
    memory,
    observationHealth,
    scan,
    scanning,
    runScan,
    failsafes,
    degraded: failsafes.length > 0,
  };
}
