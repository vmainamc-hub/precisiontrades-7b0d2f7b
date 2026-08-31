# Final Ranker

I  was building this app somewhere but didnt finish. Just very small part remaining. Please finish and build the app

Completed

- Single authoritative ranking is now wired end to end. `src/lib/apex/final-rank.ts` builds one `finalRank[]` over the whole observed population (nothing removed for being unqualified), re-stamps ranks 1..N, and attaches operator-gate + Stage 4 qualification as status with blockers. `scan.ts` returns `ranked`/`rankEntries`, `qualified` is a subset in ranking order, and `leadCandidate`/`bestOf90`/`scan.best` is strictly `finalRank[0]`, reusing the same gate result that produced the rank.

- `ScanResult` now exposes `finalRank` and `rankEntries`.

- Apex page no longer substitutes a winner: the old `top[0] → alertedLive → ranked[0]` fallback chain is gone; Rank #1 is `finalRank[0]`, shown with blockers when unqualified. Runner-up comparisons read `finalRank` instead of the qualified-only subset.

- `useStrongSignalLock` no longer re-sorts candidates — execution eligibility may only lock or skip, never redefine Rank #1.

- Folded engine panels fixed. The page-blanking `undefined is not iterable` came from `DecisionSpinePanel` destructuring `spine.lines` when absent (inside the "Digit psychology & pressure" fold); that is now guarded. Also hardened `profiles.ts` (`ctx.engines`, bucket merges, dangerous digits), `engine-effectiveness.ts` (`t.state?.engineVotes`), `simulator.ts` (`candidate.winners`) and `memory.ts` (calibration) against partial/persisted data shapes.

- Added `PanelBoundary` and wrapped every engine panel/tab (verdict, psychology, forward projection, simulator detail, simulator command centre, governance, learning, 90-cell universe, entry lab, execution) so a single panel fault reports itself instead of killing the whole terminal.

- Typecheck passes clean.

Remaining

1. The eight invariant tests for the single-ranking contract (one ranking, one Rank #1, unqualified Rank #1 still surfaced, qualification never reorders, determinism, ranks contiguous 1..N, population preserved, lock cannot override Rank #1).

2. The written engineering report.

3. Live verification of the fixed panels in the browser — this project currently has no auth users, so a session couldn't be minted for an authenticated end-to-end check.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://precisionsentinnel.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/23f2c213-7fac-487a-af4d-7912699ef15c).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
