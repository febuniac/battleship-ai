import { describe, expect, it } from 'vitest';
import { coordKey, inBounds } from './board.ts';
import { randomFleet } from './placement.ts';
import { BOARD_SIZE, FLEET, FLEET_CELL_COUNT } from './rules.ts';
import { seedRng } from './rng.ts';

describe('random fleet placement', () => {
  const SEEDS = Array.from({ length: 300 }, (_unused, index) => index + 1);

  it('always produces a complete, legal fleet', () => {
    for (const seed of SEEDS) {
      const [board] = randomFleet(seedRng(seed));

      expect(board.ships.map((ship) => ship.id).sort()).toEqual(
        FLEET.map((spec) => spec.id).sort(),
      );

      const cells = board.ships.flatMap((ship) => ship.cells);
      expect(cells).toHaveLength(FLEET_CELL_COUNT);
      expect(new Set(cells.map((cell) => coordKey(cell))).size).toBe(FLEET_CELL_COUNT);
      expect(cells.every(inBounds)).toBe(true);

      for (const ship of board.ships) {
        expect(ship.cells).toHaveLength(ship.size);
        expect(ship.hits).toBe(0);
      }
    }
  });

  it('is deterministic per seed and different across seeds', () => {
    const layout = (seed: number) =>
      randomFleet(seedRng(seed))[0].ships.map(
        (ship) => `${ship.id}:${coordKey(ship.origin)}:${ship.orientation}`,
      );

    expect(layout(11)).toEqual(layout(11));
    expect(layout(11)).not.toEqual(layout(12));
  });

  it('advances the generator state so the next draw differs', () => {
    const [, state] = randomFleet(seedRng(1));
    expect(state).not.toBe(seedRng(1));
  });

  it('spreads ships around the board across seeds', () => {
    const origins = new Set(
      SEEDS.slice(0, 100).map((seed) => coordKey(randomFleet(seedRng(seed))[0].ships[0]!.origin)),
    );
    // Sanity check that placement is not clustered in a corner.
    expect(origins.size).toBeGreaterThan(BOARD_SIZE * 2);
  });
});
