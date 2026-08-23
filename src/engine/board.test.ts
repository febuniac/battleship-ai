import { describe, expect, it } from 'vitest';
import {
  allCoords,
  coordLabel,
  createEmptyBoard,
  findShip,
  inBounds,
  isFleetSunk,
  isSunk,
  placeShip,
  receiveShot,
  removeShip,
  shipAt,
  shipFootprint,
  shotAt,
  validatePlacement,
} from './board.ts';
import { BOARD_SIZE, FLEET, shipSpec } from './rules.ts';
import { boardWithFixedFleet, fixtureShipCells, WATER } from '../testing/fixtures.ts';

describe('coordinates', () => {
  it('knows which cells are on the board', () => {
    expect(inBounds({ r: 0, c: 0 })).toBe(true);
    expect(inBounds({ r: BOARD_SIZE - 1, c: BOARD_SIZE - 1 })).toBe(true);
    expect(inBounds({ r: -1, c: 0 })).toBe(false);
    expect(inBounds({ r: 0, c: BOARD_SIZE })).toBe(false);
  });

  it('labels cells the way the UI shows them', () => {
    expect(coordLabel({ r: 0, c: 0 })).toBe('A1');
    expect(coordLabel({ r: 3, c: 1 })).toBe('B4');
    expect(coordLabel({ r: 9, c: 9 })).toBe('J10');
  });

  it('enumerates every cell exactly once', () => {
    const coords = allCoords();
    expect(coords).toHaveLength(BOARD_SIZE * BOARD_SIZE);
    expect(new Set(coords.map((coord) => coordLabel(coord))).size).toBe(coords.length);
  });

  it('lays ships out along the requested axis', () => {
    expect(shipFootprint({ r: 2, c: 3 }, 'horizontal', 3)).toEqual([
      { r: 2, c: 3 },
      { r: 2, c: 4 },
      { r: 2, c: 5 },
    ]);
    expect(shipFootprint({ r: 2, c: 3 }, 'vertical', 2)).toEqual([
      { r: 2, c: 3 },
      { r: 3, c: 3 },
    ]);
  });
});

describe('empty board', () => {
  it('has no ships and no shots', () => {
    const board = createEmptyBoard();
    expect(board.ships).toHaveLength(0);
    expect(board.shots).toHaveLength(BOARD_SIZE);
    expect(board.shots.every((row) => row.length === BOARD_SIZE)).toBe(true);
    expect(allCoords().every((coord) => shotAt(board, coord) === 'unknown')).toBe(true);
  });
});

describe('placement validation', () => {
  it('accepts a ship that fits', () => {
    expect(
      validatePlacement(createEmptyBoard(), 'carrier', { r: 0, c: 0 }, 'horizontal'),
    ).toBeNull();
  });

  it('accepts ships flush against the right and bottom edges', () => {
    const carrier = shipSpec('carrier').size;
    const board = createEmptyBoard();
    expect(
      validatePlacement(board, 'carrier', { r: 0, c: BOARD_SIZE - carrier }, 'horizontal'),
    ).toBeNull();
    expect(
      validatePlacement(board, 'carrier', { r: BOARD_SIZE - carrier, c: 0 }, 'vertical'),
    ).toBeNull();
  });

  it('rejects a ship whose last cell falls off the edge (off-by-one)', () => {
    const carrier = shipSpec('carrier').size;
    const board = createEmptyBoard();
    expect(
      validatePlacement(board, 'carrier', { r: 0, c: BOARD_SIZE - carrier + 1 }, 'horizontal'),
    ).toBe('OUT_OF_BOUNDS');
    expect(
      validatePlacement(board, 'carrier', { r: BOARD_SIZE - carrier + 1, c: 0 }, 'vertical'),
    ).toBe('OUT_OF_BOUNDS');
  });

  it('rejects negative origins', () => {
    expect(validatePlacement(createEmptyBoard(), 'destroyer', { r: -1, c: 0 }, 'horizontal')).toBe(
      'OUT_OF_BOUNDS',
    );
  });

  it('rejects overlapping ships', () => {
    const board = placeShip(createEmptyBoard(), 'carrier', { r: 0, c: 0 }, 'horizontal');
    expect(validatePlacement(board, 'battleship', { r: 0, c: 4 }, 'horizontal')).toBe('OVERLAP');
    expect(validatePlacement(board, 'battleship', { r: 0, c: 2 }, 'vertical')).toBe('OVERLAP');
  });

  it('allows ships to touch, since only overlapping is illegal', () => {
    const board = placeShip(createEmptyBoard(), 'carrier', { r: 0, c: 0 }, 'horizontal');
    // Directly below, side by side and diagonally adjacent are all legal.
    expect(validatePlacement(board, 'battleship', { r: 1, c: 0 }, 'horizontal')).toBeNull();
    expect(validatePlacement(board, 'battleship', { r: 0, c: 5 }, 'horizontal')).toBeNull();
    expect(validatePlacement(board, 'battleship', { r: 1, c: 5 }, 'vertical')).toBeNull();
  });

  it('rejects placing the same ship twice', () => {
    const board = placeShip(createEmptyBoard(), 'carrier', { r: 0, c: 0 }, 'horizontal');
    expect(validatePlacement(board, 'carrier', { r: 5, c: 5 }, 'horizontal')).toBe(
      'SHIP_ALREADY_PLACED',
    );
  });
});

describe('placing and removing ships', () => {
  it('records the ship footprint without touching the previous board', () => {
    const empty = createEmptyBoard();
    const board = placeShip(empty, 'cruiser', { r: 4, c: 4 }, 'vertical');
    const cruiser = findShip(board, 'cruiser');

    expect(empty.ships).toHaveLength(0);
    expect(cruiser).toMatchObject({ size: 3, hits: 0, orientation: 'vertical' });
    expect(cruiser?.cells).toEqual([
      { r: 4, c: 4 },
      { r: 5, c: 4 },
      { r: 6, c: 4 },
    ]);
    expect(shipAt(board, { r: 5, c: 4 })?.id).toBe('cruiser');
    expect(shipAt(board, { r: 7, c: 4 })).toBeUndefined();
  });

  it('removes only the requested ship', () => {
    const board = boardWithFixedFleet();
    const reduced = removeShip(board, 'cruiser');
    expect(reduced.ships).toHaveLength(FLEET.length - 1);
    expect(findShip(reduced, 'cruiser')).toBeUndefined();
    expect(findShip(board, 'cruiser')).toBeDefined();
  });
});

describe('resolving shots', () => {
  it('marks a miss on empty water', () => {
    const board = boardWithFixedFleet();
    const { board: next, outcome, sunkShipId } = receiveShot(board, WATER);
    expect(outcome).toBe('miss');
    expect(sunkShipId).toBeUndefined();
    expect(shotAt(next, WATER)).toBe('miss');
    expect(shotAt(board, WATER)).toBe('unknown');
  });

  it('marks a hit and counts it against the ship', () => {
    const [bow] = fixtureShipCells('carrier');
    const { board, outcome } = receiveShot(boardWithFixedFleet(), bow!);
    expect(outcome).toBe('hit');
    expect(shotAt(board, bow!)).toBe('hit');
    expect(findShip(board, 'carrier')?.hits).toBe(1);
    expect(isSunk(findShip(board, 'carrier')!)).toBe(false);
  });

  it('reports "sunk" exactly on the last cell of a ship', () => {
    const cells = fixtureShipCells('destroyer');
    let board = boardWithFixedFleet();

    const first = receiveShot(board, cells[0]!);
    expect(first.outcome).toBe('hit');
    board = first.board;

    const second = receiveShot(board, cells[1]!);
    expect(second.outcome).toBe('sunk');
    expect(second.sunkShipId).toBe('destroyer');
    expect(isSunk(findShip(second.board, 'destroyer')!)).toBe(true);
  });

  it('only reports the fleet as sunk once every ship is down', () => {
    let board = boardWithFixedFleet();
    expect(isFleetSunk(board)).toBe(false);

    const allShipCells = FLEET.flatMap((spec) => fixtureShipCells(spec.id));
    for (const cell of allShipCells.slice(0, -1)) board = receiveShot(board, cell).board;
    expect(isFleetSunk(board)).toBe(false);

    board = receiveShot(board, allShipCells.at(-1)!).board;
    expect(isFleetSunk(board)).toBe(true);
  });

  it('never treats an empty board as a sunk fleet', () => {
    expect(isFleetSunk(createEmptyBoard())).toBe(false);
  });
});
