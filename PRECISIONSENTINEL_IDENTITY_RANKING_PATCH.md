# PrecisionSentinel — Final Identity/Ranking Patch

## Purpose

This patch completes the intended single-ranking architecture:

```text
90 permanent cell identities
        ↓
all existing engine evidence
        ↓
identity conformance
        ↓
1000-tick psychology + 120-tick pressure + engine agreement + danger
        ↓
operator-gate state
        ↓
Stage 4 state
        ↓
ONE final ranking
        ↓
finalRank[0]
        ↓
Scan
```

Qualification/execution eligibility remains strict, but it does not replace Rank #1.

## Key corrections

1. `buildFinalRank()` no longer gives the boolean `qualified` status priority over the actual opportunity evidence.
2. Permanent cell identity is compared before generic raw score.
3. Graded empirical confluence is evaluated before qualification status.
4. Operator-gate state still participates in the same ranking through gate count, but `qualified` is never used as a winner selector.
5. Stage 4 remains an input to the same final ranking rather than a hidden pre-ranking.
6. `FinalDecisionEngine.evaluateStage4()` no longer sorts its output. It evaluates/annotates candidates and preserves population order; `buildFinalRank()` is the sole authoritative ordering point.
7. The canonical extreme-digit exhaustion threshold is aligned to 10.3% in the Sentinel psychology paths, matching the current operator specification.
8. Identity conformance now explicitly incorporates MOST DECREASING, EDGE GROUP, PACE GROUP, and the GREEN 0/2 (OVER) / 9/7 (UNDER) decay rule.
9. Regression coverage was added for an execution-unqualified but stronger Rank #1 and for Stage 4 not creating a competing ranking.

## Authoritative invariants

```ts
finalRank[0].rank === 1
```

and, whenever Scan has a candidate:

```ts
scanResult.bestOf90.candidate === finalRank[0]
```

An unqualified Rank #1 remains Rank #1. A lower-ranked qualified candidate must not replace it.

## Files changed

- `src/lib/apex/final-rank.ts`
- `src/lib/apex/final-rank-confluence.test.ts`
- `src/lib/apex/final-rank.test.ts`
- `src/lib/apex/final-rank-architecture-regression.test.ts`
- `src/lib/sentinel/final-decision.ts`
- `src/lib/sentinel/stage4-risk-integration.test.ts`
- `src/lib/sentinel/digit-psychology.ts`
- `src/lib/sentinel/proposal/structural-direction.ts`
- `src/lib/precision-edge-v2/psychology-of-numbers.ts`
- `src/lib/sentinel/observation/cellIdentity.ts`
- `src/lib/sentinel/observation/identityIntegrationContract.ts`
- `src/lib/apex/final-rank-identity.test.ts`

## Verification note

The source files passed basic structural sanity checks in the available environment. The repository's Node dependencies were not installed successfully within the execution environment, so a full Vitest/typecheck/build run could not be completed here. Lovable must run the repository's normal `npm test`, typecheck, lint, and build commands after integration.
