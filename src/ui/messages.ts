import { shipAt, shipFootprint } from '../engine/board.ts';
import { shipSpec } from '../engine/rules.ts';
import type { Board, Coord, IllegalReason, Orientation, ShipId } from '../engine/types.ts';

const REASON_TEXT: Readonly<Record<IllegalReason, string>> = {
  OUT_OF_BOUNDS: 'Ship would extend off the board',
  OVERLAP: 'Overlaps another ship',
  SHIP_ALREADY_PLACED: 'That ship is already on the board',
  SHIP_NOT_PLACED: 'That ship has not been placed yet',
  FLEET_INCOMPLETE: 'Place all five ships before starting',
  ALREADY_FIRED: 'You have already fired at that cell',
  NOT_YOUR_TURN: 'Wait for your turn',
  WRONG_PHASE: 'That is not possible right now',
};

export function reasonText(reason: IllegalReason): string {
  return REASON_TEXT[reason];
}

/**
 * Player-facing wording for a rejected placement. The verdict itself always comes from the
 * engine; this only names the ship that is in the way, which the engine does not report.
 */
export function placementReasonText(
  board: Board,
  shipId: ShipId,
  origin: Coord,
  orientation: Orientation,
  reason: IllegalReason,
): string {
  if (reason !== 'OVERLAP') return reasonText(reason);

  const blocking = shipFootprint(origin, orientation, shipSpec(shipId).size)
    .map((cell) => shipAt(board, cell))
    .find((ship) => ship !== undefined);

  return blocking ? `Overlaps ${shipSpec(blocking.id).name}` : reasonText(reason);
}
