/**
 * Headless self-play simulation: `npm run simulate [games] [firstSeed]`.
 *
 * Runs AI-vs-AI games through the real reducer and asserts the global invariants - every game
 * terminates, has exactly one winner, and never plays an illegal move (illegal moves throw
 * inside the driver). Also reports how many shots the AI needs, which is a quick sanity check
 * on opponent strength. Runs in plain Node: the engine has no bundler or DOM dependency.
 */
import { playSelfPlayGame } from '../src/testing/selfPlay.ts';
import { FLEET_CELL_COUNT } from '../src/engine/rules.ts';

const games = Number(process.argv[2] ?? 500);
const firstSeed = Number(process.argv[3] ?? 1);

const shotsToWin: number[] = [];
const wins = { human: 0, ai: 0 };

const startedAt = performance.now();
for (let index = 0; index < games; index += 1) {
  const result = playSelfPlayGame(firstSeed + index);
  wins[result.winner] += 1;
  shotsToWin.push(result.shots[result.winner]);
}
const elapsedMs = performance.now() - startedAt;

const mean = shotsToWin.reduce((sum, value) => sum + value, 0) / shotsToWin.length;
const sorted = [...shotsToWin].sort((a, b) => a - b);

console.log(`games:            ${games} (seeds ${firstSeed}..${firstSeed + games - 1})`);
console.log(`winners:          seat A ${wins.human} / seat B ${wins.ai}`);
console.log(
  `shots to win:     min ${sorted[0]} · mean ${mean.toFixed(1)} · max ${sorted[games - 1]}`,
);
console.log(`perfect game:     ${FLEET_CELL_COUNT} shots`);
console.log(`illegal moves:    0 (any illegal move throws)`);
console.log(`elapsed:          ${elapsedMs.toFixed(0)} ms`);
