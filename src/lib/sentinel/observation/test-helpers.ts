/**
 * Test-only helper: primes the singleton observation engine.
 *
 * `rankOpportunities()` / `scanNow()` read exclusively from the singleton
 * `observationEngine` (ApexCore is the only authoritative producer in the app).
 * Unit tests that pass mock `MarketIntel` objects therefore see an empty
 * ranking unless the singleton has observed cells. This helper feeds
 * deterministic, supportive evidence into every cell so the ranking pipeline
 * has a full 90-cell population to work with.
 */
import { observationEngine } from "./observationEngine";
import { MARKET_IDS, PROPOSITIONS } from "./constants";
import { emptyEvidenceInput } from "./engineAdapter";

export interface SeedOptions {
  /** Number of supportive observations per cell. */
  cycles?: number;
  /** Base timestamp; each cycle advances by 1000ms. */
  startTs?: number;
  /** Restrict seeding to these markets (defaults to the full universe). */
  markets?: readonly string[];
  /** Rebuild all cells first so the suite is isolated from earlier tests. */
  reset?: boolean;
}

export function seedObservationEngine(opts: SeedOptions = {}): void {
  const cycles = opts.cycles ?? 40;
  const startTs = opts.startTs ?? 1_000_000;
  const markets = opts.markets ?? MARKET_IDS;

  if (opts.reset) observationEngine.resetCells();

  for (let i = 0; i < cycles; i++) {
    const ts = startTs + i * 1000;
    for (const marketId of markets) {
      for (const prop of PROPOSITIONS) {
        const input = emptyEvidenceInput(marketId, prop, ts);
        const under = prop.startsWith("UNDER");
        input.psychology = {
          direction: under ? "UNDER" : "OVER",
          state: "COHERENT",
          support: "SUPPORTING",
        };
        input.entryDigit = {
          digit: under ? 4 : 6,
          state: "VALIDATED",
          support: "SUPPORTING",
          dangerousCompetitor: false,
        };
        input.pressure.byWindow = {
          15: "SUPPORTING",
          30: "SUPPORTING",
          60: "SUPPORTING",
          120: "SUPPORTING",
        };
        input.losingSidePressure = { state: "DECLINING", severity: "NONE" };
        input.trigger = { state: "VALID" };
        input.regime = {
          classification: "TRENDING_PERSISTENT",
          confidence: 0.9,
          transitioning: false,
          compatibility: "COMPATIBLE",
        };
        input.statistics = { strength: "STRONG", sampleSize: 100 };
        observationEngine.ingest(input);
      }
    }
  }
}
