import { describe, expect, it } from 'vitest';
import { findShip, isFleetSunk, shotAt } from './board.ts';
import { applyAction, applyActionOrThrow, createInitialState, isFleetComplete } from './reducer.ts';
import { FLEET } from './rules.ts';
import type { Action, ActionResult, Coord, GameState, Player } from './types.ts';
import { deepFreeze, fixtureShipCells, startedGame, WATER } from '../testing/fixtures.ts';

function expectOk(result: ActionResult): GameState {
  if (!result.ok) throw new Error(`Expected success, got ${result.reason}`);
  return result.state;
}

function fire(state: GameState, player: Player, at: Coord): ActionResult {
  return applyAction(state, { type: 'FIRE', player, at });
}

/** Fire a whole list of cells, asserting each shot is legal. */
function fireAll(state: GameState, player: Player, cells: readonly Coord[]): GameState {
  return cells.reduce((current, at) => expectOk(fire(current, player, at)), state);
}

describe('initial state', () => {
  it('starts in placement with an AI fleet already placed', () => {
    const state = createInitialState(1);
    expect(state.phase).toBe('placement');
    expect(state.turn).toBe('human');
    expect(state.winner).toBeNull();
    expect(state.log).toEqual([]);
    expect(state.boards.human.ships).toHaveLength(0);
    expect(isFleetComplete(state.boards.ai)).toBe(true);
  });

  it('is reproducible from its seed', () => {
    const layout = (state: GameState) =>
      state.boards.ai.ships.map(
        (ship) => `${ship.id}${ship.origin.r}${ship.origin.c}${ship.orientation}`,
      );
    expect(layout(createInitialState(7))).toEqual(layout(createInitialState(7)));
    expect(layout(createInitialState(7))).not.toEqual(layout(createInitialState(8)));
  });
});

describe('placement phase', () => {
  it('places a ship for the human player only', () => {
    const state = expectOk(
      applyAction(createInitialState(1), {
        type: 'PLACE_SHIP',
        shipId: 'carrier',
        origin: { r: 0, c: 0 },
        orientation: 'horizontal',
      }),
    );
    expect(state.boards.human.ships).toHaveLength(1);
    expect(findShip(state.boards.human, 'carrier')?.cells).toHaveLength(5);
  });

  it('surfaces the placement reason instead of throwing', () => {
    const state = createInitialState(1);
    const offBoard = applyAction(state, {
      type: 'PLACE_SHIP',
      shipId: 'carrier',
      origin: { r: 0, c: 9 },
      orientation: 'horizontal',
    });
    expect(offBoard).toEqual({ ok: false, reason: 'OUT_OF_BOUNDS' });

    const placed = expectOk(
      applyAction(state, {
        type: 'PLACE_SHIP',
        shipId: 'carrier',
        origin: { r: 0, c: 0 },
        orientation: 'horizontal',
      }),
    );
    expect(
      applyAction(placed, {
        type: 'PLACE_SHIP',
        shipId: 'battleship',
        origin: { r: 0, c: 3 },
        orientation: 'horizontal',
      }),
    ).toEqual({ ok: false, reason: 'OVERLAP' });
    expect(
      applyAction(placed, {
        type: 'PLACE_SHIP',
        shipId: 'carrier',
        origin: { r: 5, c: 0 },
        orientation: 'horizontal',
      }),
    ).toEqual({ ok: false, reason: 'SHIP_ALREADY_PLACED' });
  });

  it('removes a placed ship and rejects removing one that is not placed', () => {
    const placed = expectOk(
      applyAction(createInitialState(1), {
        type: 'PLACE_SHIP',
        shipId: 'cruiser',
        origin: { r: 3, c: 3 },
        orientation: 'vertical',
      }),
    );
    expect(
      expectOk(applyAction(placed, { type: 'REMOVE_SHIP', shipId: 'cruiser' })).boards.human.ships,
    ).toHaveLength(0);
    expect(applyAction(placed, { type: 'REMOVE_SHIP', shipId: 'carrier' })).toEqual({
      ok: false,
      reason: 'SHIP_NOT_PLACED',
    });
  });

  it('randomizes and clears the human fleet', () => {
    const randomized = expectOk(applyAction(createInitialState(1), { type: 'RANDOMIZE_FLEET' }));
    expect(isFleetComplete(randomized.boards.human)).toBe(true);

    const cleared = expectOk(applyAction(randomized, { type: 'CLEAR_FLEET' }));
    expect(cleared.boards.human.ships).toHaveLength(0);
  });

  it('randomizing twice gives different layouts because the rng advances', () => {
    const first = expectOk(applyAction(createInitialState(1), { type: 'RANDOMIZE_FLEET' }));
    const second = expectOk(applyAction(first, { type: 'CLEAR_FLEET' }));
    const third = expectOk(applyAction(second, { type: 'RANDOMIZE_FLEET' }));
    const layout = (state: GameState) =>
      state.boards.human.ships.map((ship) => `${ship.id}${ship.origin.r}${ship.origin.c}`);
    expect(layout(third)).not.toEqual(layout(first));
  });

  it('refuses to start until the whole fleet is placed', () => {
    let state = createInitialState(1);
    expect(applyAction(state, { type: 'START_GAME' })).toEqual({
      ok: false,
      reason: 'FLEET_INCOMPLETE',
    });

    state = expectOk(applyAction(state, { type: 'RANDOMIZE_FLEET' }));
    state = expectOk(applyAction(state, { type: 'START_GAME' }));
    expect(state.phase).toBe('playing');
    expect(state.turn).toBe('human');
  });

  it('rejects firing before the game starts', () => {
    expect(fire(createInitialState(1), 'human', { r: 0, c: 0 })).toEqual({
      ok: false,
      reason: 'WRONG_PHASE',
    });
  });
});

describe('firing', () => {
  it('records a miss and hands the turn over', () => {
    const state = expectOk(fire(startedGame(), 'human', WATER));
    expect(shotAt(state.boards.ai, WATER)).toBe('miss');
    expect(state.turn).toBe('ai');
    expect(state.stats.human).toMatchObject({ shots: 1, hits: 0 });
    expect(state.log.at(-1)).toMatchObject({ player: 'human', outcome: 'miss', seq: 0 });
  });

  it('records a hit', () => {
    const [bow] = fixtureShipCells('carrier');
    const state = expectOk(fire(startedGame(), 'human', bow!));
    expect(shotAt(state.boards.ai, bow!)).toBe('hit');
    expect(state.stats.human).toMatchObject({ shots: 1, hits: 1 });
    expect(state.log.at(-1)).toMatchObject({ outcome: 'hit' });
  });

  it('rejects a shot outside the board', () => {
    expect(fire(startedGame(), 'human', { r: 10, c: 0 })).toEqual({
      ok: false,
      reason: 'OUT_OF_BOUNDS',
    });
  });

  it('rejects a shot from the player whose turn it is not', () => {
    expect(fire(startedGame(), 'ai', WATER)).toEqual({ ok: false, reason: 'NOT_YOUR_TURN' });
  });

  it('rejects firing after the game is over', () => {
    const finished = fireAll(
      startedGame(),
      'human',
      FLEET.flatMap((spec) => fixtureShipCells(spec.id)),
    );
    expect(finished.phase).toBe('gameOver');
    expect(fire(finished, 'human', WATER)).toEqual({ ok: false, reason: 'WRONG_PHASE' });
  });

  it('reports a sink with the ship that went down', () => {
    const state = fireAll(startedGame(), 'human', fixtureShipCells('destroyer'));
    expect(state.log.at(-1)).toMatchObject({ outcome: 'sunk', sunkShipId: 'destroyer' });
    expect(state.stats.ai.lostShipIds).toEqual(['destroyer']);
    expect(state.log.filter((entry) => entry.outcome === 'sunk')).toHaveLength(1);
  });
});

describe('duplicate shots', () => {
  it('are rejected without consuming the turn or changing anything', () => {
    let state = expectOk(fire(startedGame(), 'human', WATER));
    expect(state.turn).toBe('ai');
    // Each seat tracks its own shots: the same coordinate on the other board is a fresh shot.
    state = expectOk(fire(state, 'ai', WATER));
    expect(state.turn).toBe('human');

    expect(fire(state, 'human', WATER)).toEqual({ ok: false, reason: 'ALREADY_FIRED' });

    // The turn did not move, so the human may still fire elsewhere.
    const elsewhere = expectOk(fire(state, 'human', { r: 9, c: 9 }));
    expect(elsewhere.stats.human.shots).toBe(2);
    expect(state.stats.human.shots).toBe(1);
  });

  it('are rejected on a previously hit cell too', () => {
    const [bow] = fixtureShipCells('carrier');
    const afterHit = expectOk(fire(startedGame(), 'human', bow!));
    expect(afterHit.turn).toBe('human');
    expect(fire(afterHit, 'human', bow!)).toEqual({ ok: false, reason: 'ALREADY_FIRED' });
    expect(afterHit.log).toHaveLength(1);
  });
});

describe('extra turn on a hit', () => {
  it('keeps the turn with the attacker after a hit', () => {
    const [bow] = fixtureShipCells('carrier');
    const state = expectOk(fire(startedGame(), 'human', bow!));
    expect(state.turn).toBe('human');
  });

  it('keeps the turn through a streak of hits and hands it over on the first miss', () => {
    const cells = fixtureShipCells('carrier');
    let state = startedGame();
    for (const cell of cells.slice(0, 4)) {
      state = expectOk(fire(state, 'human', cell));
      expect(state.turn).toBe('human');
    }
    expect(state.stats.human).toMatchObject({ shots: 4, hits: 4 });

    state = expectOk(fire(state, 'human', WATER));
    expect(state.turn).toBe('ai');
  });

  it('keeps the turn after a sink that does not end the game', () => {
    const state = fireAll(startedGame(), 'human', fixtureShipCells('destroyer'));
    expect(state.phase).toBe('playing');
    expect(state.turn).toBe('human');
  });

  it('gives the turn back to the same player after the opponent misses', () => {
    let state = expectOk(fire(startedGame(), 'human', WATER));
    state = expectOk(fire(state, 'ai', WATER));
    expect(state.turn).toBe('human');
  });
});

describe('winning', () => {
  const allShipCells = FLEET.flatMap((spec) => fixtureShipCells(spec.id));

  it('ends the game on the shot that sinks the last ship', () => {
    const beforeLast = fireAll(startedGame(), 'human', allShipCells.slice(0, -1));
    expect(beforeLast.phase).toBe('playing');
    expect(beforeLast.winner).toBeNull();

    const final = expectOk(fire(beforeLast, 'human', allShipCells.at(-1)!));
    expect(final.phase).toBe('gameOver');
    expect(final.winner).toBe('human');
    expect(isFleetSunk(final.boards.ai)).toBe(true);
    expect(final.log.at(-1)).toMatchObject({ outcome: 'sunk', wonGame: true });
  });

  it('does not grant another turn once the game is won', () => {
    const final = fireAll(startedGame(), 'human', allShipCells);
    expect(final.stats.ai.lostShipIds).toHaveLength(FLEET.length);
    for (const action of [
      { type: 'FIRE', player: 'human', at: WATER },
      { type: 'FIRE', player: 'ai', at: WATER },
      { type: 'RANDOMIZE_FLEET' },
      { type: 'START_GAME' },
    ] satisfies Action[]) {
      expect(applyAction(final, action)).toEqual({ ok: false, reason: 'WRONG_PHASE' });
    }
  });

  it('lets the AI seat win the same way', () => {
    let state = expectOk(fire(startedGame(), 'human', WATER));
    state = fireAll(state, 'ai', allShipCells);
    expect(state.winner).toBe('ai');
    expect(state.phase).toBe('gameOver');
  });
});

describe('reset', () => {
  it('returns to the placement phase with a fresh board', () => {
    const finished = fireAll(
      startedGame(),
      'human',
      FLEET.flatMap((spec) => fixtureShipCells(spec.id)),
    );
    const reset = expectOk(applyAction(finished, { type: 'RESET' }));

    expect(reset.phase).toBe('placement');
    expect(reset.winner).toBeNull();
    expect(reset.log).toEqual([]);
    expect(reset.boards.human.ships).toHaveLength(0);
    expect(isFleetComplete(reset.boards.ai)).toBe(true);
    expect(reset.stats.human).toMatchObject({ shots: 0, hits: 0 });
  });

  it('deals a different AI layout than the game just played', () => {
    const state = expectOk(applyAction(createInitialState(1), { type: 'RANDOMIZE_FLEET' }));
    const reset = expectOk(applyAction(state, { type: 'RESET' }));
    const layout = (game: GameState) =>
      game.boards.ai.ships.map((ship) => `${ship.id}${ship.origin.r}${ship.origin.c}`);
    expect(layout(reset)).not.toEqual(layout(state));
  });
});

describe('immutability', () => {
  it('never mutates the state it is given', () => {
    const state = deepFreeze(startedGame());
    const [bow] = fixtureShipCells('carrier');

    expect(() =>
      applyActionOrThrow(state, { type: 'FIRE', player: 'human', at: bow! }),
    ).not.toThrow();
    expect(state.log).toHaveLength(0);
    expect(state.stats.human.shots).toBe(0);
    expect(shotAt(state.boards.ai, bow!)).toBe('unknown');
    expect(findShip(state.boards.ai, 'carrier')?.hits).toBe(0);
  });

  it('leaves untouched rows of the shot grid shared, not cloned', () => {
    const state = startedGame();
    const next = expectOk(fire(state, 'human', { r: 0, c: 9 }));
    expect(next.boards.ai.shots[5]).toBe(state.boards.ai.shots[5]);
    expect(next.boards.ai.shots[0]).not.toBe(state.boards.ai.shots[0]);
  });
});

describe('applyActionOrThrow', () => {
  it('throws with the reason for an illegal action', () => {
    expect(() => applyActionOrThrow(createInitialState(1), { type: 'START_GAME' })).toThrow(
      /FLEET_INCOMPLETE/,
    );
  });
});
