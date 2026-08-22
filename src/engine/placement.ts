import { createEmptyBoard, placeShip, validatePlacement } from './board.ts';
import { BOARD_SIZE, FLEET } from './rules.ts';
import { nextInt, type RngState } from './rng.ts';
import type { Board, Orientation } from './types.ts';

const ORIENTATIONS: readonly Orientation[] = ['horizontal', 'vertical'];

/**
 * Place the whole fleet at random. Rejection sampling: ships are tried largest-first, so
 * on a 10x10 board a valid layout is found almost immediately. The attempt cap only
 * guards against a pathological seed; exceeding it restarts from an empty board.
 */
export function randomFleet(rng: RngState): readonly [Board, RngState] {
  const MAX_ATTEMPTS_PER_SHIP = 500;

  for (let restart = 0; restart < 10; restart += 1) {
    let board = createEmptyBoard();
    let state = rng;
    let placedAll = true;

    for (const spec of FLEET) {
      let placed = false;
      for (let attempt = 0; attempt < MAX_ATTEMPTS_PER_SHIP && !placed; attempt += 1) {
        const [orientationIndex, s1] = nextInt(state, ORIENTATIONS.length);
        const [r, s2] = nextInt(s1, BOARD_SIZE);
        const [c, s3] = nextInt(s2, BOARD_SIZE);
        state = s3;

        const orientation = ORIENTATIONS[orientationIndex] ?? 'horizontal';
        const origin = { r, c };
        if (validatePlacement(board, spec.id, origin, orientation) === null) {
          board = placeShip(board, spec.id, origin, orientation);
          placed = true;
        }
      }
      if (!placed) {
        placedAll = false;
        break;
      }
    }

    if (placedAll) return [board, state];
    rng = state;
  }

  throw new Error('Failed to generate a valid random fleet');
}
