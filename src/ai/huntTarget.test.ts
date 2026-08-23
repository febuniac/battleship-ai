import { describe, expect, it } from 'vitest';
import {
  createHuntTargetAI,
  huntCandidates,
  targetCandidates,
  unresolvedHits,
} from './huntTarget.ts';
import { createAI, AI_STRATEGIES, DEFAULT_AI_STRATEGY } from './index.ts';
import { coordKey } from '../engine/board.ts';
import { createRng } from '../engine/rng.ts';
import { BOARD_SIZE } from '../engine/rules.ts';
import type { CellState, Coord } from '../engine/types.ts';
import type { PlayerView, SunkShipView } from '../engine/view.ts';

/** Build a view from an ASCII board: `.` unknown, `o` miss, `x` hit. */
function viewFrom(rows: readonly string[], sunkShips: readonly SunkShipView[] = []): PlayerView {
  const shots: CellState[][] = Array.from({ length: BOARD_SIZE }, (_unused, r) =>
    Array.from({ length: BOARD_SIZE }, (_cell, c) => {
      const char = rows[r]?.[c] ?? '.';
      if (char === 'x') return 'hit';
      if (char === 'o') return 'miss';
      return 'unknown';
    }),
  );
  return { size: BOARD_SIZE, shots, sunkShips, remainingShipSizes: [5, 4, 3, 3, 2] };
}

const keys = (coords: readonly Coord[]) => new Set(coords.map((coord) => coordKey(coord)));
const ai = createHuntTargetAI();
const rng = () => createRng(1234);

describe('hunting', () => {
  it('only fires on the parity lattice while nothing is unresolved', () => {
    const view = viewFrom([]);
    expect(huntCandidates(view)).toHaveLength((BOARD_SIZE * BOARD_SIZE) / 2);
    expect(huntCandidates(view).every((cell) => (cell.r + cell.c) % 2 === 0)).toBe(true);

    const shot = ai.nextShot(view, rng());
    expect((shot.r + shot.c) % 2).toBe(0);
  });

  it('falls back to the other parity once the lattice is exhausted', () => {
    // Every parity cell already fired at, one odd cell left unknown.
    const rows = Array.from({ length: BOARD_SIZE }, (_unused, r) =>
      Array.from({ length: BOARD_SIZE }, (_cell, c) =>
        (r + c) % 2 === 0 ? 'o' : r === 0 && c === 1 ? '.' : 'o',
      ).join(''),
    );
    const view = viewFrom(rows);
    expect(huntCandidates(view)).toEqual([{ r: 0, c: 1 }]);
    expect(ai.nextShot(view, rng())).toEqual({ r: 0, c: 1 });
  });

  it('never repeats a cell that has already been fired at', () => {
    const rows = ['ooooooooo.', ...Array.from({ length: 9 }, () => 'oooooooooo')];
    const view = viewFrom(rows);
    expect(ai.nextShot(view, rng())).toEqual({ r: 0, c: 9 });
  });

  it('throws only when the board is completely exhausted', () => {
    const view = viewFrom(Array.from({ length: BOARD_SIZE }, () => 'oooooooooo'));
    expect(() => ai.nextShot(view, rng())).toThrow(/No cell left/);
  });
});

describe('targeting a single hit', () => {
  const view = viewFrom(['....x.....']);

  it('treats a hit with no sunk ship as unresolved', () => {
    expect(unresolvedHits(view)).toEqual([{ r: 0, c: 4 }]);
  });

  it('probes the orthogonal neighbours, clipped to the board', () => {
    expect(keys(targetCandidates(view))).toEqual(
      keys([
        { r: 1, c: 4 },
        { r: 0, c: 3 },
        { r: 0, c: 5 },
      ]),
    );
  });

  it('fires at one of those neighbours rather than hunting', () => {
    for (let seed = 0; seed < 20; seed += 1) {
      const shot = ai.nextShot(view, createRng(seed));
      expect(keys(targetCandidates(view)).has(coordKey(shot))).toBe(true);
    }
  });

  it('skips neighbours that were already fired at', () => {
    const probed = viewFrom(['...ox.....', '....o.....']);
    expect(keys(targetCandidates(probed))).toEqual(keys([{ r: 0, c: 5 }]));
  });
});

describe('locking onto a ship axis', () => {
  it('extends a horizontal line at both ends', () => {
    const view = viewFrom(['..xx......']);
    expect(keys(targetCandidates(view))).toEqual(
      keys([
        { r: 0, c: 1 },
        { r: 0, c: 4 },
      ]),
    );
  });

  it('extends a vertical line at both ends', () => {
    const view = viewFrom(['..........', '....x.....', '....x.....']);
    expect(keys(targetCandidates(view))).toEqual(
      keys([
        { r: 0, c: 4 },
        { r: 3, c: 4 },
      ]),
    );
  });

  it('keeps extending in the only open direction after a dead end', () => {
    const view = viewFrom(['.oxx......']);
    expect(targetCandidates(view)).toEqual([{ r: 0, c: 4 }]);
  });

  it('prefers extending a line over probing an unrelated single hit', () => {
    const view = viewFrom(['..xx......', '..........', '.......x..']);
    expect(keys(targetCandidates(view))).toEqual(
      keys([
        { r: 0, c: 1 },
        { r: 0, c: 4 },
      ]),
    );
  });

  it('probes all around an L-shaped cluster, which means two touching ships', () => {
    const view = viewFrom(['..xx......', '...x......']);
    const candidates = keys(targetCandidates(view));
    expect(candidates.has(coordKey({ r: 0, c: 1 }))).toBe(true);
    expect(candidates.has(coordKey({ r: 0, c: 4 }))).toBe(true);
    expect(candidates.has(coordKey({ r: 2, c: 3 }))).toBe(true);
    expect(candidates.has(coordKey({ r: 1, c: 2 }))).toBe(true);
  });
});

describe('after a sink', () => {
  const sunkDestroyer: SunkShipView = {
    id: 'destroyer',
    size: 2,
    cells: [
      { r: 0, c: 2 },
      { r: 0, c: 3 },
    ],
  };

  it('stops chasing hits that the sunk ship explains', () => {
    const view = viewFrom(['..xx......'], [sunkDestroyer]);
    expect(unresolvedHits(view)).toEqual([]);
    expect(targetCandidates(view)).toEqual([]);
  });

  it('resumes hunting on parity cells', () => {
    const view = viewFrom(['..xx......'], [sunkDestroyer]);
    const shot = ai.nextShot(view, rng());
    expect((shot.r + shot.c) % 2).toBe(0);
  });

  it('still chases a hit left over from a different ship', () => {
    const view = viewFrom(['..xx......', '.......x..'], [sunkDestroyer]);
    expect(unresolvedHits(view)).toEqual([{ r: 1, c: 7 }]);
    expect(keys(targetCandidates(view))).toEqual(
      keys([
        { r: 0, c: 7 },
        { r: 2, c: 7 },
        { r: 1, c: 6 },
        { r: 1, c: 8 },
      ]),
    );
  });
});

describe('determinism', () => {
  it('picks the same shot for the same view and seed', () => {
    const view = viewFrom([]);
    expect(ai.nextShot(view, createRng(99))).toEqual(ai.nextShot(view, createRng(99)));
  });

  it('picks different shots for different seeds', () => {
    const view = viewFrom([]);
    const shots = new Set(
      Array.from({ length: 20 }, (_unused, seed) => coordKey(ai.nextShot(view, createRng(seed)))),
    );
    expect(shots.size).toBeGreaterThan(1);
  });
});

describe('strategy registry', () => {
  it('exposes the shipped strategy under its id', () => {
    expect(Object.keys(AI_STRATEGIES)).toEqual(['huntTarget']);
    expect(createAI().id).toBe(DEFAULT_AI_STRATEGY);
    expect(createAI('huntTarget')).toMatchObject({ id: 'huntTarget', name: 'Hunt & Target' });
  });
});
