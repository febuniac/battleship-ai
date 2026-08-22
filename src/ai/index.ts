import { createHuntTargetAI } from './huntTarget.ts';
import type { AIFactory, AIStrategyId } from './types.ts';

/**
 * Strategy registry. Adding an opponent (e.g. a probability-density AI) means adding one
 * file and one entry here - no engine or UI change.
 */
export const AI_STRATEGIES: Readonly<Record<AIStrategyId, AIFactory>> = {
  huntTarget: createHuntTargetAI,
};

export const DEFAULT_AI_STRATEGY: AIStrategyId = 'huntTarget';

export function createAI(id: AIStrategyId = DEFAULT_AI_STRATEGY) {
  return AI_STRATEGIES[id]();
}

export * from './types.ts';
export { createHuntTargetAI } from './huntTarget.ts';
