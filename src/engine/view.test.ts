import { describe, expect, it } from 'vitest';
import { createPlayerView, sunkCellKeys, viewCell } from './view.ts';
import { BOARD_SIZE } from './rules.ts';
import { applyActionOrThrow } from './reducer.ts';
import { fixtureShipCells, startedGame, WATER } from '../testing/fixtures.ts';
import type { Coord, GameState } from './types.ts';

const sorted = <T>(values: readonly T[]): T[] => [...values].sort();

function fire(state: GameState, at: Coord): GameState {
  return applyActionOrThrow(state, { type: 'FIRE', player: 'human', at });
}

describe('player view', () => {
  it('starts fully unknown', () => {
    const view = createPlayerView(startedGame(), 'human');
    expect(view.size).toBe(BOARD_SIZE);
    expect(view.shots.flat().every((cell) => cell === 'unknown')).toBe(true);
    expect(view.sunkShips).toEqual([]);
    expect(sorted(view.remainingShipSizes)).toEqual([2, 3, 3, 4, 5]);
  });

  it('never exposes the opponent ship layout', () => {
    const view = createPlayerView(startedGame(), 'human');
    expect(sorted(Object.keys(view))).toEqual(['remainingShipSizes', 'shots', 'size', 'sunkShips']);
    expect('ships' in view).toBe(false);
    expect(JSON.stringify(view)).not.toContain('"origin"');
  });

  it('makes an occupied cell indistinguishable from water until it is fired at', () => {
    const state = startedGame();
    const view = createPlayerView(state, 'human');
    const [occupied] = fixtureShipCells('carrier');
    expect(viewCell(view, occupied!)).toBe('unknown');
    expect(viewCell(view, WATER)).toBe('unknown');
  });

  it('reflects hits and misses as they happen', () => {
    const [bow] = fixtureShipCells('carrier');
    let state = fire(startedGame(), bow!);
    state = fire(state, WATER);

    const view = createPlayerView(state, 'human');
    expect(viewCell(view, bow!)).toBe('hit');
    expect(viewCell(view, WATER)).toBe('miss');
  });

  it('reveals a ship only once it is sunk, and drops it from the remaining sizes', () => {
    const cells = fixtureShipCells('destroyer');
    let state = startedGame();
    state = fire(state, cells[0]!);
    expect(createPlayerView(state, 'human').sunkShips).toEqual([]);

    state = fire(state, cells[1]!);
    const view = createPlayerView(state, 'human');
    expect(view.sunkShips).toEqual([{ id: 'destroyer', size: 2, cells }]);
    expect(sorted(view.remainingShipSizes)).toEqual([3, 3, 4, 5]);
    expect(sunkCellKeys(view)).toEqual(new Set(['8,0', '8,1']));
  });

  it('is symmetric: each side sees only the other side', () => {
    const state = fire(startedGame(), WATER);
    expect(viewCell(createPlayerView(state, 'human'), WATER)).toBe('miss');
    expect(viewCell(createPlayerView(state, 'ai'), WATER)).toBe('unknown');
  });

  it('treats out-of-range lookups as unknown', () => {
    const view = createPlayerView(startedGame(), 'human');
    expect(viewCell(view, { r: -1, c: 0 })).toBe('unknown');
    expect(viewCell(view, { r: 0, c: BOARD_SIZE })).toBe('unknown');
  });

  it('hands out copies, so a strategy cannot write into engine state', () => {
    const state = startedGame();
    const view = createPlayerView(state, 'human');
    (view.shots[0] as string[])[0] = 'hit';
    expect(createPlayerView(state, 'human').shots[0]?.[0]).toBe('unknown');
  });
});
