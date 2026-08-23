import { isSunk } from './board.ts';
import { BOARD_SIZE } from './rules.ts';
import type { CellState, Coord, GameState, Player, ShipId } from './types.ts';

export interface SunkShipView {
  readonly id: ShipId;
  readonly size: number;
  /** Revealed once the ship is sunk — exactly what the UI shows the human player. */
  readonly cells: readonly Coord[];
}

/**
 * Everything a player legitimately knows about the opponent's board.
 *
 * Deliberately does *not* contain the opponent's `ships`, so an AI physically cannot
 * peek at un-hit ship positions: fairness is enforced by the type, not by convention.
 */
export interface PlayerView {
  readonly size: number;
  /** `shots[r][c]`: `unknown` until fired at, then `hit` or `miss`. */
  readonly shots: readonly (readonly CellState[])[];
  readonly sunkShips: readonly SunkShipView[];
  /** Sizes of the opponent ships still afloat (which ship is which stays hidden). */
  readonly remainingShipSizes: readonly number[];
}

/** Build `viewer`'s view of their opponent's board. */
export function createPlayerView(state: GameState, viewer: Player): PlayerView {
  const opponent: Player = viewer === 'human' ? 'ai' : 'human';
  const board = state.boards[opponent];

  const sunkShips = board.ships.filter(isSunk).map((ship) => ({
    id: ship.id,
    size: ship.size,
    cells: ship.cells,
  }));

  return {
    size: BOARD_SIZE,
    shots: board.shots.map((row) => [...row]),
    sunkShips,
    remainingShipSizes: board.ships.filter((ship) => !isSunk(ship)).map((ship) => ship.size),
  };
}

export function viewCell(view: PlayerView, coord: Coord): CellState {
  return view.shots[coord.r]?.[coord.c] ?? 'unknown';
}

/** Convenience for tests and for the AI: cells belonging to already-sunk ships. */
export function sunkCellKeys(view: PlayerView): ReadonlySet<string> {
  return new Set(view.sunkShips.flatMap((ship) => ship.cells.map((cell) => `${cell.r},${cell.c}`)));
}
