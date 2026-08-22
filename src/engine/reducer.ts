import {
  createEmptyBoard,
  inBounds,
  isFleetSunk,
  findShip,
  placeShip,
  receiveShot,
  removeShip,
  shotAt,
  validatePlacement,
} from './board.ts';
import { randomFleet } from './placement.ts';
import { FLEET } from './rules.ts';
import { nextInt, seedRng, type RngState } from './rng.ts';
import type {
  Action,
  ActionResult,
  Board,
  Coord,
  GameState,
  LogEntry,
  Player,
  PlayerStats,
} from './types.ts';

const EMPTY_STATS: PlayerStats = { shots: 0, hits: 0, lostShipIds: [] };

function opponentOf(player: Player): Player {
  return player === 'human' ? 'ai' : 'human';
}

/**
 * Fresh game in the placement phase. The AI fleet is placed immediately from the seed so
 * the whole game is reproducible; the human places their own fleet through actions.
 */
export function createInitialState(seed: number): GameState {
  const [aiBoard, rng] = randomFleet(seedRng(seed));
  return {
    phase: 'placement',
    turn: 'human',
    boards: { human: createEmptyBoard(), ai: aiBoard },
    winner: null,
    log: [],
    stats: { human: EMPTY_STATS, ai: EMPTY_STATS },
    rng,
  };
}

export function isFleetComplete(board: Board): boolean {
  return board.ships.length === FLEET.length;
}

function withHumanBoard(state: GameState, board: Board, rng?: RngState): GameState {
  return {
    ...state,
    boards: { ...state.boards, human: board },
    ...(rng === undefined ? {} : { rng }),
  };
}

function fire(state: GameState, player: Player, at: Coord): ActionResult {
  if (state.phase !== 'playing') return { ok: false, reason: 'WRONG_PHASE' };
  if (state.turn !== player) return { ok: false, reason: 'NOT_YOUR_TURN' };
  if (!inBounds(at)) return { ok: false, reason: 'OUT_OF_BOUNDS' };

  const defender = opponentOf(player);
  const defenderBoard = state.boards[defender];
  // A repeat shot changes nothing at all - the turn stays with the attacker.
  if (shotAt(defenderBoard, at) !== 'unknown') return { ok: false, reason: 'ALREADY_FIRED' };

  const { board, outcome, sunkShipId } = receiveShot(defenderBoard, at);
  const hit = outcome !== 'miss';
  const won = isFleetSunk(board);

  const attackerStats = state.stats[player];
  const defenderStats = state.stats[defender];

  const entry: LogEntry = {
    seq: state.log.length,
    player,
    at,
    outcome,
    ...(sunkShipId ? { sunkShipId } : {}),
    ...(won ? { wonGame: true as const } : {}),
  };

  return {
    ok: true,
    state: {
      ...state,
      boards: { ...state.boards, [defender]: board },
      // A hit grants another turn; a miss hands the turn over.
      turn: hit ? player : defender,
      phase: won ? 'gameOver' : 'playing',
      winner: won ? player : null,
      log: [...state.log, entry],
      stats: {
        ...state.stats,
        [player]: {
          ...attackerStats,
          shots: attackerStats.shots + 1,
          hits: attackerStats.hits + (hit ? 1 : 0),
        },
        [defender]: sunkShipId
          ? { ...defenderStats, lostShipIds: [...defenderStats.lostShipIds, sunkShipId] }
          : defenderStats,
      },
    },
  };
}

/**
 * The single entry point that mutates game state - shared by the UI, the AI driver and the
 * tests. Returns a new state on success or a typed reason on rejection; `state` is never
 * modified in place.
 */
export function applyAction(state: GameState, action: Action): ActionResult {
  switch (action.type) {
    case 'PLACE_SHIP': {
      if (state.phase !== 'placement') return { ok: false, reason: 'WRONG_PHASE' };
      const reason = validatePlacement(
        state.boards.human,
        action.shipId,
        action.origin,
        action.orientation,
      );
      if (reason) return { ok: false, reason };
      return {
        ok: true,
        state: withHumanBoard(
          state,
          placeShip(state.boards.human, action.shipId, action.origin, action.orientation),
        ),
      };
    }

    case 'REMOVE_SHIP': {
      if (state.phase !== 'placement') return { ok: false, reason: 'WRONG_PHASE' };
      if (!findShip(state.boards.human, action.shipId)) {
        return { ok: false, reason: 'SHIP_NOT_PLACED' };
      }
      const board = removeShip(state.boards.human, action.shipId);
      return { ok: true, state: withHumanBoard(state, board) };
    }

    case 'RANDOMIZE_FLEET': {
      if (state.phase !== 'placement') return { ok: false, reason: 'WRONG_PHASE' };
      const [board, rng] = randomFleet(state.rng);
      return { ok: true, state: withHumanBoard(state, board, rng) };
    }

    case 'CLEAR_FLEET': {
      if (state.phase !== 'placement') return { ok: false, reason: 'WRONG_PHASE' };
      return { ok: true, state: withHumanBoard(state, createEmptyBoard()) };
    }

    case 'START_GAME': {
      if (state.phase !== 'placement') return { ok: false, reason: 'WRONG_PHASE' };
      if (!isFleetComplete(state.boards.human)) return { ok: false, reason: 'FLEET_INCOMPLETE' };
      return { ok: true, state: { ...state, phase: 'playing', turn: 'human' } };
    }

    case 'FIRE':
      return fire(state, action.player, action.at);

    case 'RESET': {
      // Derive the next seed from the current generator state: a reset stays deterministic.
      const [seed] = nextInt(state.rng, 2 ** 31 - 1);
      return { ok: true, state: createInitialState(seed) };
    }
  }
}

/** Throwing variant for tests and scripted flows where an illegal action is a bug. */
export function applyActionOrThrow(state: GameState, action: Action): GameState {
  const result = applyAction(state, action);
  if (!result.ok) {
    throw new Error(`Illegal action ${action.type}: ${result.reason}`);
  }
  return result.state;
}
