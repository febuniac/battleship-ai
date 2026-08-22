# battleship-ai

Battleship played in the browser against an AI opponent. Fully client-side: no backend, no
network calls, no persistence.

**Status:** engine + AI + tests (PR 1). The UI is a placeholder shell; the playable interface
and the public deployment land in the following PRs.

## Rules

- 10×10 board, standard fleet: Carrier 5, Battleship 4, Cruiser 3, Submarine 3, Destroyer 2.
- Ships are axis-aligned, may touch, may not overlap.
- A hit grants another turn; a miss hands the turn over.
- The shot that sinks the last enemy ship ends the game immediately.

## Architecture

```
src/engine/   pure game logic - no React, no DOM, no ambient randomness
  types.ts      Coord/Ship/Board/GameState/Action/IllegalReason
  rules.ts      board size, fleet spec, rule flags
  rng.ts        seeded Mulberry32 PRNG (pure state stepping + Rng facade)
  board.ts      placement validation, immutable placement, shot resolution, sink/win checks
  placement.ts  deterministic random fleet generation
  view.ts       PlayerView: what a player legitimately knows about the opponent
  reducer.ts    applyAction(state, action) -> { ok, state } | { ok: false, reason }
src/ai/       AIPlayer implementations
  huntTarget.ts  hunt on a parity lattice, target around unresolved hits, extend along the axis
  index.ts       strategy registry (add a strategy = one file + one entry)
  driver.ts      drives an AI turn through the real reducer, including hit streaks
src/ui/       placeholder shell (PR 2)
src/testing/  fixtures + headless self-play harness
```

Design constraints enforced by the code, not by convention:

- The engine is framework-agnostic and immutable; the UI will be a projection of `GameState`.
- All randomness is an injected seeded RNG, so every game is reproducible from a seed.
- The AI only ever receives a `PlayerView`, which structurally cannot contain the opponent's
  ship layout — it can't cheat even by accident.
- Illegal actions return a typed `IllegalReason` and leave the state untouched.
- ESLint forbids React/DOM imports, `Math.random` and `Date.now` inside `src/engine` and `src/ai`.

## Commands

```bash
npm install
npm run dev            # Vite dev server
npm run build          # typecheck + production build
npm run typecheck
npm run lint
npm run format
npm test               # Vitest
npm run test:coverage  # engine + AI, 90% thresholds
npm run simulate       # 500 headless AI-vs-AI games: winners, shot distribution, illegal moves
```

Requires Node ≥ 22.12 (see `.nvmrc`, pinned to the current 22 LTS patch): Vite 8 needs 22.12+, and
`npm run simulate` relies on Node running TypeScript directly.

## Testing strategy

Tests target game-logic bugs rather than rendering: placement edge cases and off-by-one errors,
duplicate shots, the extra-turn streak rule, sink/win transitions, state immutability, AI
targeting behaviour, an information-leak test on `PlayerView`, and seeded self-play invariants
(every game terminates with exactly one winner and no illegal move) plus a statistical check
that the AI stays materially better than random guessing.

## License

MIT
