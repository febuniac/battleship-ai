# battleship-ai

Battleship played in the browser against an AI opponent. Fully client-side: no backend, no
network calls, no persistence.

**Live:** _not deployed yet — the public URL goes here once the Vercel deployment is set up._

## How to play

1. **Start game** on the opening screen to enter placement.
2. **Place your fleet.** Pick a ship from the tray, press **Rotate** (or `R`) to switch
   orientation, then click a cell to drop it. Pick a placed ship back up by choosing it in the
   tray, or by clicking it on the board once the fleet is complete. A rejected placement never
   touches the ships already on the water.
   **Randomize fleet** places all five for you; **Begin battle** unlocks once the fleet is legal.
3. **Fire.** Click a cell on _Enemy waters_. A hit keeps your turn, a miss hands over to the AI,
   which then fires until it misses.
4. **Win** by sinking all five enemy ships before the AI sinks yours, then **Play again**.

Everything is keyboard-operable: `Tab` into a board, arrow keys / `Home` / `End` to move,
`Enter` or `Space` to place or fire, `R` to rotate. Cells expose their coordinate and state
("B4, hit") and events go to a polite live region. Board states are distinguishable without
colour (ring = miss, ✕ = hit, hatched ✕ = sunk), and animations respect
`prefers-reduced-motion`.

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
src/ui/       React projection of the engine
  useGame.ts        the only React-side owner of game state: dispatches actions through
                    applyAction and paces the AI turn (one shot per timer tick)
  WelcomeScreen     opening screen: title, matchup, one line, one CTA into placement
  PlacementScreen   ship tray, rotation (button + R), click placement, engine-backed preview
  GameScreen        both boards, turn line, contextual status line, game-over overlay
  components/       AppHeader, Board, Cell, ShipLayer, ShipSprite, ShipTray, StatusLine,
                    TurnBanner, GameOverOverlay, LiveRegion (polite aria-live announcements)
  announcements.ts  one shared wording per shot, used by the status line and the live region
  messages.ts       IllegalReason -> player-facing wording
  urlOptions.ts     `?seed=`/`?aiDelay=` test hooks for E2E determinism, not surfaced in the UI
e2e/          Playwright journey against the production bundle
src/testing/  fixtures + headless self-play harness
```

Design constraints enforced by the code, not by convention:

- The engine is framework-agnostic and immutable; the UI is a projection of `GameState` and holds
  no rules of its own — even the placement preview asks the engine for its verdict.
- The AI turn is a loop by construction: `useGame` schedules one shot, and because a hit leaves the
  turn with the AI the effect re-runs, so a streak is visible shot by shot instead of instantly.
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
npm test               # Vitest: `engine` (node) + `ui` (jsdom) projects
npm run test:coverage  # engine + AI, 90% thresholds
npm run test:e2e       # Playwright: builds, serves the bundle, plays a seeded game in Chromium
npm run simulate       # 500 headless AI-vs-AI games: winners, shot distribution, illegal moves
```

First E2E run only: `npx playwright install chromium`.

Requires Node ≥ 22.12 (see `.nvmrc`, pinned to the current 22 LTS patch): Vite 8 needs 22.12+, and
`npm run simulate` relies on Node running TypeScript directly.

## Testing strategy

Tests target game-logic bugs rather than rendering: placement edge cases and off-by-one errors,
duplicate shots, the extra-turn streak rule, sink/win transitions, state immutability, AI
targeting behaviour, an information-leak test on `PlayerView`, and seeded self-play invariants
(every game terminates with exactly one winner and no illegal move) plus a statistical check
that the AI stays materially better than random guessing.

The `ui` project adds behaviour tests (not snapshots) for the rules as the player experiences them:
the opening screen handoff, invalid-placement feedback, Begin battle gating, firing, cell lockout, the extra-turn streak, the
handoff back to the player, game-over lockout, and a clean reset on Play again. They run against a
fixed seed, so the AI fleet is known and hits/misses can be chosen deliberately.

One Playwright suite covers the real journey end to end against the built bundle: opening screen →
randomize →
start → hit keeps the turn → miss hands over → AI replies → seeded game played to victory →
game-over stats → Play again returns to a clean placement screen, plus a keyboard-only pass, a
390px viewport check for overflow and touch-target size, and a contrast pass that measures every
visible text against the surface it actually sits on (glass included) at WCAG AA. It asserts on state and accessible names
(`?seed=` fixes the fleet, `?aiDelay=0` removes pacing) rather than sleeping, and fails on any
browser console error.

## Deployment

Static SPA, no backend or environment variables. On Vercel: import the repository, framework
preset **Vite**, build `npm run build`, output `dist/`. Any static host works —
`npm run build && npx serve dist` is equivalent locally.

## License

MIT
