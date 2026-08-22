import { BOARD_SIZE, shipSpec } from './rules.ts';
import type {
  Board,
  CellState,
  Coord,
  IllegalReason,
  Orientation,
  Ship,
  ShipId,
  ShotOutcome,
} from './types.ts';

export function inBounds({ r, c }: Coord): boolean {
  return r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE;
}

export function sameCoord(a: Coord, b: Coord): boolean {
  return a.r === b.r && a.c === b.c;
}

export function coordKey({ r, c }: Coord): string {
  return `${r},${c}`;
}

/** Human-readable coordinate, e.g. `{ r: 3, c: 1 }` -> `B4`. */
export function coordLabel({ r, c }: Coord): string {
  return `${String.fromCharCode(65 + c)}${r + 1}`;
}

export function allCoords(): readonly Coord[] {
  const coords: Coord[] = [];
  for (let r = 0; r < BOARD_SIZE; r += 1) {
    for (let c = 0; c < BOARD_SIZE; c += 1) coords.push({ r, c });
  }
  return coords;
}

/** The cells a ship of `size` would occupy, ignoring board limits. */
export function shipFootprint(origin: Coord, orientation: Orientation, size: number): Coord[] {
  return Array.from({ length: size }, (_unused, index) =>
    orientation === 'horizontal'
      ? { r: origin.r, c: origin.c + index }
      : { r: origin.r + index, c: origin.c },
  );
}

export function createEmptyBoard(): Board {
  return {
    ships: [],
    shots: Array.from({ length: BOARD_SIZE }, () =>
      Array.from({ length: BOARD_SIZE }, (): CellState => 'unknown'),
    ),
  };
}

export function shotAt(board: Board, { r, c }: Coord): CellState {
  return board.shots[r]?.[c] ?? 'unknown';
}

export function findShip(board: Board, id: ShipId): Ship | undefined {
  return board.ships.find((ship) => ship.id === id);
}

export function shipAt(board: Board, coord: Coord): Ship | undefined {
  return board.ships.find((ship) => ship.cells.some((cell) => sameCoord(cell, coord)));
}

export function isSunk(ship: Ship): boolean {
  return ship.hits >= ship.size;
}

export function isFleetSunk(board: Board): boolean {
  return board.ships.length > 0 && board.ships.every(isSunk);
}

/**
 * Why a placement is illegal, or `null` when it is legal. Ships are allowed to touch,
 * so adjacency is deliberately not a rejection reason.
 */
export function validatePlacement(
  board: Board,
  shipId: ShipId,
  origin: Coord,
  orientation: Orientation,
): IllegalReason | null {
  if (findShip(board, shipId)) return 'SHIP_ALREADY_PLACED';

  const cells = shipFootprint(origin, orientation, shipSpec(shipId).size);
  if (!cells.every(inBounds)) return 'OUT_OF_BOUNDS';

  const occupied = new Set(board.ships.flatMap((ship) => ship.cells.map((cell) => coordKey(cell))));
  if (cells.some((cell) => occupied.has(coordKey(cell)))) return 'OVERLAP';

  return null;
}

export function placeShip(
  board: Board,
  shipId: ShipId,
  origin: Coord,
  orientation: Orientation,
): Board {
  const { size } = shipSpec(shipId);
  const ship: Ship = {
    id: shipId,
    size,
    origin,
    orientation,
    cells: shipFootprint(origin, orientation, size),
    hits: 0,
  };
  return { ...board, ships: [...board.ships, ship] };
}

export function removeShip(board: Board, shipId: ShipId): Board {
  return { ...board, ships: board.ships.filter((ship) => ship.id !== shipId) };
}

export interface ShotResolution {
  readonly board: Board;
  readonly outcome: ShotOutcome;
  readonly sunkShipId?: ShipId;
}

/**
 * Resolve a shot against `board`. The caller must have already rejected repeat shots
 * (`shotAt(board, at) !== 'unknown'`); this function assumes a fresh, in-bounds cell.
 */
export function receiveShot(board: Board, at: Coord): ShotResolution {
  const target = shipAt(board, at);
  const shots = board.shots.map((row, r) =>
    r === at.r ? row.map((cell, c) => (c === at.c ? (target ? 'hit' : 'miss') : cell)) : row,
  );

  if (!target) return { board: { ...board, shots }, outcome: 'miss' };

  const hitShip: Ship = { ...target, hits: target.hits + 1 };
  const ships = board.ships.map((ship) => (ship.id === hitShip.id ? hitShip : ship));
  const nextBoard: Board = { ships, shots };

  return isSunk(hitShip)
    ? { board: nextBoard, outcome: 'sunk', sunkShipId: hitShip.id }
    : { board: nextBoard, outcome: 'hit' };
}
