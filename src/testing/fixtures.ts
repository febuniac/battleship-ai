import { createEmptyBoard, placeShip } from '../engine/board.ts';
import { createInitialState } from '../engine/reducer.ts';
import { FLEET } from '../engine/rules.ts';
import type { Board, Coord, GameState, Orientation, ShipId } from '../engine/types.ts';

export interface PlacementFixture {
  readonly shipId: ShipId;
  readonly origin: Coord;
  readonly orientation: Orientation;
}

/** Deterministic fleet: one ship per even row, all horizontal from column 0. */
export const FIXED_FLEET: readonly PlacementFixture[] = FLEET.map((spec, index) => ({
  shipId: spec.id,
  origin: { r: index * 2, c: 0 },
  orientation: 'horizontal' as const,
}));

export function boardWithFixedFleet(): Board {
  return FIXED_FLEET.reduce(
    (board, { shipId, origin, orientation }) => placeShip(board, shipId, origin, orientation),
    createEmptyBoard(),
  );
}

/** Game in the `playing` phase where both fleets sit at the known `FIXED_FLEET` positions. */
export function startedGame(seed = 1): GameState {
  return {
    ...createInitialState(seed),
    phase: 'playing',
    turn: 'human',
    boards: { human: boardWithFixedFleet(), ai: boardWithFixedFleet() },
  };
}

/** Cells of a fixture ship, so tests can express "sink the cruiser" without hard-coded coords. */
export function fixtureShipCells(shipId: ShipId): readonly Coord[] {
  const fixture = FIXED_FLEET.find((entry) => entry.shipId === shipId);
  const spec = FLEET.find((entry) => entry.id === shipId);
  if (!fixture || !spec) throw new Error(`Unknown fixture ship: ${shipId}`);
  return Array.from({ length: spec.size }, (_unused, index) => ({
    r: fixture.origin.r,
    c: fixture.origin.c + index,
  }));
}

/** A cell guaranteed to be water on a `FIXED_FLEET` board (odd rows hold no ships). */
export const WATER: Coord = { r: 1, c: 1 };

export function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value as Record<string, unknown>)) deepFreeze(nested);
  }
  return value;
}
