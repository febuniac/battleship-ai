import { createAI } from '../ai/index.ts';
import { playAITurn } from '../ai/driver.ts';
import type { AIStrategyId } from '../ai/types.ts';
import { applyActionOrThrow, createInitialState } from '../engine/reducer.ts';
import { createRng } from '../engine/rng.ts';
import { isFleetSunk } from '../engine/board.ts';
import type { GameState, Player } from '../engine/types.ts';

export interface SelfPlayResult {
  readonly seed: number;
  readonly winner: Player;
  readonly shots: Readonly<Record<Player, number>>;
  readonly totalShots: number;
  readonly finalState: GameState;
}

/**
 * Headless AI-vs-AI game: both seats get a random fleet and are driven by the same strategy.
 * Every shot goes through `applyAction`, so an illegal move throws instead of being tolerated.
 * Fully determined by `seed`.
 */
export function playSelfPlayGame(seed: number, strategy?: AIStrategyId): SelfPlayResult {
  const ai = strategy ? createAI(strategy) : createAI();
  const rng = createRng(seed ^ 0x9e3779b9);

  let state = applyActionOrThrow(createInitialState(seed), { type: 'RANDOMIZE_FLEET' });
  state = applyActionOrThrow(state, { type: 'START_GAME' });

  const MAX_TURNS = 400;
  for (let turn = 0; state.phase === 'playing'; turn += 1) {
    if (turn >= MAX_TURNS) throw new Error(`Game did not terminate within ${MAX_TURNS} turns`);
    state = playAITurn(state, state.turn, ai, rng);
  }

  if (state.winner === null) throw new Error('Game ended without a winner');
  const loser: Player = state.winner === 'human' ? 'ai' : 'human';
  if (!isFleetSunk(state.boards[loser])) throw new Error('Game ended with the loser still afloat');
  if (isFleetSunk(state.boards[state.winner])) throw new Error('Both fleets were sunk');

  return {
    seed,
    winner: state.winner,
    shots: { human: state.stats.human.shots, ai: state.stats.ai.shots },
    totalShots: state.stats.human.shots + state.stats.ai.shots,
    finalState: state,
  };
}
