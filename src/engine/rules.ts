import type { ShipSpec } from './types.ts';

export const BOARD_SIZE = 10;

/** Standard fleet: 5 ships, 17 cells total. */
export const FLEET: readonly ShipSpec[] = [
  { id: 'carrier', name: 'Carrier', size: 5 },
  { id: 'battleship', name: 'Battleship', size: 4 },
  { id: 'cruiser', name: 'Cruiser', size: 3 },
  { id: 'submarine', name: 'Submarine', size: 3 },
  { id: 'destroyer', name: 'Destroyer', size: 2 },
];

export const FLEET_CELL_COUNT = FLEET.reduce((total, ship) => total + ship.size, 0);

/** Ships may sit next to each other; only overlapping is illegal. */
export const SHIPS_MAY_TOUCH = true;

/** A hit keeps the turn with the attacker; a miss hands it over. */
export const HIT_GRANTS_EXTRA_TURN = true;

export function shipSpec(id: ShipSpec['id']): ShipSpec {
  const spec = FLEET.find((entry) => entry.id === id);
  if (!spec) throw new Error(`Unknown ship id: ${id}`);
  return spec;
}
