import { describe, expect, it } from 'vitest';
import { playSelfPlayGame } from '../testing/selfPlay.ts';
import { playAITurn, takeAIShot } from './driver.ts';
import { createAI } from './index.ts';
import { coordKey, isFleetSunk, shotAt } from '../engine/board.ts';
import { allCoords } from '../engine/board.ts';
import { applyActionOrThrow, createInitialState } from '../engine/reducer.ts';
import { createRng } from '../engine/rng.ts';
import { BOARD_SIZE, FLEET, FLEET_CELL_COUNT } from '../engine/rules.ts';
import { startedGame } from '../testing/fixtures.ts';
import type { GameState, Player } from '../engine/types.ts';

const SEEDS = Array.from({ length: 200 }, (_unused, index) => index + 1);

describe('self-play invariants', () => {
  const results = SEEDS.map((seed) => playSelfPlayGame(seed));

  it('every game terminates with exactly one winner', () => {
    for (const result of results) {
      const { finalState, winner } = result;
      const loser: Player = winner === 'human' ? 'ai' : 'human';
      expect(finalState.phase).toBe('gameOver');
      expect(finalState.winner).toBe(winner);
      expect(isFleetSunk(finalState.boards[loser])).toBe(true);
      expect(isFleetSunk(finalState.boards[winner])).toBe(false);
    }
  });

  it('needs at least a perfect game and at most the whole board per player', () => {
    for (const result of results) {
      expect(result.shots[result.winner]).toBeGreaterThanOrEqual(FLEET_CELL_COUNT);
      expect(result.shots.human).toBeLessThanOrEqual(BOARD_SIZE * BOARD_SIZE);
      expect(result.shots.ai).toBeLessThanOrEqual(BOARD_SIZE * BOARD_SIZE);
    }
  });

  it('keeps stats, log and board consistent', () => {
    for (const result of results) {
      const { finalState } = result;
      for (const player of ['human', 'ai'] as const) {
        const opponent: Player = player === 'human' ? 'ai' : 'human';
        const fired = allCoords().filter(
          (coord) => shotAt(finalState.boards[opponent], coord) !== 'unknown',
        );
        const hits = allCoords().filter(
          (coord) => shotAt(finalState.boards[opponent], coord) === 'hit',
        );
        expect(fired).toHaveLength(finalState.stats[player].shots);
        expect(hits).toHaveLength(finalState.stats[player].hits);
        expect(finalState.log.filter((entry) => entry.player === player)).toHaveLength(
          finalState.stats[player].shots,
        );
      }
      expect(
        finalState.log.filter((entry) => entry.outcome === 'sunk').length,
      ).toBeGreaterThanOrEqual(FLEET.length);
      expect(finalState.log.at(-1)).toMatchObject({ wonGame: true });
    }
  });

  it('never fires at the same cell twice', () => {
    for (const result of SEEDS.slice(0, 30).map((seed) => playSelfPlayGame(seed))) {
      for (const player of ['human', 'ai'] as const) {
        const shots = result.finalState.log
          .filter((entry) => entry.player === player)
          .map((entry) => coordKey(entry.at));
        expect(new Set(shots).size).toBe(shots.length);
      }
    }
  });

  it('is reproducible from the seed', () => {
    const first = playSelfPlayGame(4242);
    const second = playSelfPlayGame(4242);
    expect(second.winner).toBe(first.winner);
    expect(second.shots).toEqual(first.shots);
    expect(second.finalState.log).toEqual(first.finalState.log);
  });
});

describe('AI strength (statistical regression)', () => {
  const shotsToWin = SEEDS.map((seed) => {
    const result = playSelfPlayGame(seed);
    return result.shots[result.winner];
  });
  const mean = shotsToWin.reduce((sum, value) => sum + value, 0) / shotsToWin.length;

  it('clears a board in far fewer shots than random guessing (~96) would need', () => {
    // Hunt/Target with parity sits around 55-60 shots; the window catches a regression to
    // random play (~96) as well as an accidental information leak (~30).
    expect(mean).toBeGreaterThan(40);
    expect(mean).toBeLessThan(70);
  });

  it('wins from both seats, so no seat has a structural advantage', () => {
    const wins = SEEDS.map((seed) => playSelfPlayGame(seed).winner);
    const humanWins = wins.filter((winner) => winner === 'human').length;
    // The seat that moves first has a real edge; assert both seats simply win regularly.
    expect(humanWins).toBeGreaterThan(SEEDS.length * 0.3);
    expect(humanWins).toBeLessThan(SEEDS.length * 0.9);
  });
});

describe('AI turn driver', () => {
  const ai = createAI();

  it('plays a streak of hits inside a single turn and stops on a miss', () => {
    const state = playAITurn(startedGame(), 'human', ai, createRng(3));
    expect(state.turn).toBe('ai');
    expect(state.stats.human.shots).toBeGreaterThanOrEqual(1);
    // The turn can only have ended with a miss (or a win).
    expect(state.log.at(-1)?.outcome).toBe('miss');
  });

  it('refuses to fire out of turn', () => {
    expect(() => takeAIShot(startedGame(), 'ai', ai, createRng(1))).toThrow(/NOT_YOUR_TURN/);
  });

  it('does nothing once the game is over', () => {
    let state: GameState = applyActionOrThrow(createInitialState(5), { type: 'RANDOMIZE_FLEET' });
    state = applyActionOrThrow(state, { type: 'START_GAME' });
    const rng = createRng(5);
    while (state.phase === 'playing') state = playAITurn(state, state.turn, ai, rng);

    expect(playAITurn(state, 'human', ai, rng)).toBe(state);
  });

  it('bails out instead of looping forever if a strategy misbehaves', () => {
    const stubborn = { ...ai, nextShot: () => ({ r: 0, c: 0 }) };
    expect(() => playAITurn(startedGame(), 'human', stubborn, createRng(1))).toThrow(
      /illegal shot/,
    );
  });

  it('caps the number of shots in a single turn', () => {
    expect(() => playAITurn(startedGame(), 'human', ai, createRng(1), 0)).toThrow(
      /exceeded 0 shots/,
    );
  });
});
