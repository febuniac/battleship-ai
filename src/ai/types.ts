import type { Rng } from '../engine/rng.ts';
import type { Coord } from '../engine/types.ts';
import type { PlayerView } from '../engine/view.ts';

export type AIStrategyId = 'huntTarget';

export interface AIPlayer {
  readonly id: AIStrategyId;
  readonly name: string;
  readonly description: string;
  /**
   * Choose the next cell to fire at. Must return an unshot, in-bounds coordinate.
   *
   * `view` is the opponent-facing projection only: it carries no un-hit ship positions,
   * so a strategy cannot cheat. Randomness must come from `rng` so games stay reproducible.
   */
  nextShot(view: PlayerView, rng: Rng): Coord;
}

export type AIFactory = () => AIPlayer;
