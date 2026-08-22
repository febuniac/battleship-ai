import { useCallback, useEffect, useRef, useState } from 'react';
import { takeAIShot } from '../ai/driver.ts';
import { createAI } from '../ai/index.ts';
import type { AIPlayer, AIStrategyId } from '../ai/types.ts';
import { validatePlacement } from '../engine/board.ts';
import { applyAction, createInitialState } from '../engine/reducer.ts';
import { createRng, type Rng } from '../engine/rng.ts';
import type {
  Action,
  Coord,
  GameState,
  IllegalReason,
  Orientation,
  ShipId,
} from '../engine/types.ts';

export interface UseGameOptions {
  /** Fixed seed for reproducible games; defaults to a fresh random one per mount. */
  readonly seed?: number;
  /** Delay before each AI shot, so a streak reads as a sequence rather than a jump. */
  readonly aiDelayMs?: number;
  readonly strategy?: AIStrategyId;
}

export interface Game {
  readonly state: GameState;
  /** Bumped by `reset`: lets the UI tell a fresh game apart from the very first one. */
  readonly generation: number;
  /** True while the AI holds the turn: the player's input must be locked out. */
  readonly aiThinking: boolean;
  /** Engine verdict for a hypothetical placement, used for the hover preview. */
  checkPlacement(shipId: ShipId, origin: Coord, orientation: Orientation): IllegalReason | null;
  place(shipId: ShipId, origin: Coord, orientation: Orientation): IllegalReason | null;
  remove(shipId: ShipId): IllegalReason | null;
  randomize(): IllegalReason | null;
  clearFleet(): IllegalReason | null;
  start(): IllegalReason | null;
  fire(at: Coord): IllegalReason | null;
  reset(): IllegalReason | null;
}

/** New games get a random seed; the engine itself never touches `Math.random`. */
function freshSeed(): number {
  return Math.floor(Math.random() * 2 ** 31);
}

/**
 * React binding for the engine. The engine stays the single source of truth: this hook only
 * owns *when* actions are dispatched (including the paced AI turn) and never re-implements a
 * rule. Every mutation goes through `applyAction`, and a rejected action returns its
 * `IllegalReason` to the caller for display.
 */
export function useGame(options: UseGameOptions = {}): Game {
  const { seed, aiDelayMs = 550, strategy } = options;

  const [initialSeed] = useState(() => seed ?? freshSeed());
  const [state, setState] = useState<GameState>(() => createInitialState(initialSeed));
  const [generation, setGeneration] = useState(0);
  // The ref mirrors `state` so dispatch always validates against the newest state and can
  // report the rejection reason synchronously, without a stale render closure.
  const stateRef = useRef(state);
  const rngRef = useRef<Rng>(createRng(initialSeed));
  const aiRef = useRef<AIPlayer>(strategy ? createAI(strategy) : createAI());

  const commit = useCallback((next: GameState) => {
    stateRef.current = next;
    setState(next);
  }, []);

  const dispatch = useCallback(
    (action: Action): IllegalReason | null => {
      const result = applyAction(stateRef.current, action);
      if (!result.ok) return result.reason;
      commit(result.state);
      return null;
    },
    [commit],
  );

  // One effect iteration = one AI shot. A hit leaves the turn with the AI, which produces a
  // new state and re-runs this effect: that is the streak, paced by the same delay. The view
  // is rebuilt inside `takeAIShot`, so a mid-streak sink is taken into account immediately.
  useEffect(() => {
    if (state.phase !== 'playing' || state.turn !== 'ai') return;
    const timer = setTimeout(() => {
      commit(takeAIShot(stateRef.current, 'ai', aiRef.current, rngRef.current));
    }, aiDelayMs);
    return () => {
      clearTimeout(timer);
    };
  }, [state, aiDelayMs, commit]);

  // The engine derives the next game's seed from the current generator state, so a seeded
  // session stays reproducible across restarts; React only re-seeds the AI's own generator.
  const reset = useCallback((): IllegalReason | null => {
    const result = applyAction(stateRef.current, { type: 'RESET' });
    if (!result.ok) return result.reason;
    rngRef.current = createRng(result.state.rng);
    commit(result.state);
    setGeneration((current) => current + 1);
    return null;
  }, [commit]);

  return {
    state,
    generation,
    aiThinking: state.phase === 'playing' && state.turn === 'ai',
    checkPlacement: (shipId, origin, orientation) =>
      validatePlacement(stateRef.current.boards.human, shipId, origin, orientation),
    place: (shipId, origin, orientation) =>
      dispatch({ type: 'PLACE_SHIP', shipId, origin, orientation }),
    remove: (shipId) => dispatch({ type: 'REMOVE_SHIP', shipId }),
    randomize: () => dispatch({ type: 'RANDOMIZE_FLEET' }),
    clearFleet: () => dispatch({ type: 'CLEAR_FLEET' }),
    start: () => dispatch({ type: 'START_GAME' }),
    fire: (at) => dispatch({ type: 'FIRE', player: 'human', at }),
    reset,
  };
}
