import { applyAction } from '../engine/reducer.ts';
import type { Rng } from '../engine/rng.ts';
import type { GameState, Player } from '../engine/types.ts';
import { createPlayerView } from '../engine/view.ts';
import type { AIPlayer } from './types.ts';

/**
 * Fire a single AI-chosen shot for `player`. Illegal shots throw, because they can only mean
 * a strategy bug: the AI is handed the same view the engine validates against.
 */
export function takeAIShot(state: GameState, player: Player, ai: AIPlayer, rng: Rng): GameState {
  const at = ai.nextShot(createPlayerView(state, player), rng);
  const result = applyAction(state, { type: 'FIRE', player, at });
  if (!result.ok) {
    throw new Error(`AI "${ai.id}" fired an illegal shot at ${at.r},${at.c}: ${result.reason}`);
  }
  return result.state;
}

/**
 * Play out a full AI turn: because a hit grants another turn, one turn can be a streak of
 * shots. The view is rebuilt for every shot, so a sink mid-streak is taken into account
 * immediately. `maxShots` is a safety net against a strategy that never terminates.
 */
export function playAITurn(
  state: GameState,
  player: Player,
  ai: AIPlayer,
  rng: Rng,
  maxShots = 200,
): GameState {
  let current = state;
  let shots = 0;
  while (current.phase === 'playing' && current.turn === player) {
    if (shots >= maxShots) throw new Error(`AI "${ai.id}" exceeded ${maxShots} shots in one turn`);
    current = takeAIShot(current, player, ai, rng);
    shots += 1;
  }
  return current;
}
