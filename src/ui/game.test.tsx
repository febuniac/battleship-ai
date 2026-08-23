import { act, render, screen, within } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { allCoords, coordLabel, shipAt } from '../engine/board.ts';
import { applyAction, createInitialState } from '../engine/reducer.ts';
import type { Coord } from '../engine/types.ts';
import { App } from './App.tsx';

const SEED = 20240617;
// Long enough that the shared clock never fires a shot on its own: every AI shot in these
// tests is stepped explicitly by `aiTick`.
const AI_DELAY = 50_000;

/** The AI fleet for `SEED` is known up front, so hits and misses can be chosen deliberately. */
const aiBoard = createInitialState(SEED).boards.ai;
const aiShipCells = allCoords().filter((at) => shipAt(aiBoard, at) !== undefined);
const aiWaterCells = allCoords().filter((at) => shipAt(aiBoard, at) === undefined);

function enemyCell(at: Coord): HTMLElement {
  const board = screen.getByRole('region', { name: 'Enemy waters' });
  return within(board).getByRole('button', { name: new RegExp(`^${coordLabel(at)} `) });
}

function ownCell(at: Coord): HTMLElement {
  const board = screen.getByRole('region', { name: 'Your waters' });
  return within(board).getByRole('button', { name: new RegExp(`^${coordLabel(at)} `) });
}

function banner(): string {
  return screen.getAllByRole('status')[0]?.textContent ?? '';
}

function aiLogEntries(): string[] {
  const log = screen.getByRole('region', { name: 'Shot log' });
  return within(log)
    .queryAllByRole('listitem')
    .map((item) => item.textContent ?? '')
    .filter((text) => text.startsWith('AI '));
}

/** Let exactly one paced AI shot resolve. */
async function aiTick(): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(AI_DELAY);
  });
}

async function startGame(user: UserEvent): Promise<void> {
  await user.click(screen.getByRole('button', { name: 'Randomize fleet' }));
  await user.click(screen.getByRole('button', { name: 'Start game' }));
}

describe('Battleship app', () => {
  let user: UserEvent;

  beforeEach(() => {
    // `shouldAdvanceTime` keeps user-event's own waits working under fake timers.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<App seed={SEED} aiDelayMs={AI_DELAY} />);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('placement', () => {
    it('renders an empty board and the full ship tray', () => {
      expect(screen.getByRole('heading', { name: 'Deploy your fleet' })).toBeDefined();
      const tray = screen.getByRole('list', { name: 'Fleet' });
      expect(within(tray).getAllByRole('listitem')).toHaveLength(5);
      expect(within(tray).queryAllByText('Placed')).toHaveLength(0);
    });

    it('reports the engine reason when a placement would leave the board', async () => {
      await user.hover(ownCell({ r: 0, c: 7 }));
      expect(screen.getByRole('status').textContent).toBe('Ship would extend off the board');
    });

    it('names the blocking ship when a placement would overlap', async () => {
      await user.click(ownCell({ r: 0, c: 0 }));
      await user.hover(ownCell({ r: 0, c: 2 }));
      expect(screen.getByRole('status').textContent).toBe('Overlaps Carrier');
    });

    it('keeps Start game disabled until all five ships are placed', async () => {
      const start = screen.getByRole('button', { name: 'Start game' });
      expect(start).toHaveProperty('disabled', true);

      await user.click(ownCell({ r: 0, c: 0 }));
      expect(start).toHaveProperty('disabled', true);

      await user.click(screen.getByRole('button', { name: 'Randomize fleet' }));
      expect(start).toHaveProperty('disabled', false);
    });

    it('removes a placed ship when its cell is clicked again', async () => {
      await user.click(ownCell({ r: 0, c: 0 }));
      expect(
        within(screen.getByRole('list', { name: 'Fleet' })).getAllByText('Placed'),
      ).toHaveLength(1);

      await user.click(ownCell({ r: 0, c: 0 }));
      expect(
        within(screen.getByRole('list', { name: 'Fleet' })).queryAllByText('Placed'),
      ).toHaveLength(0);
    });

    it('rotates with the R shortcut', async () => {
      expect(screen.getByRole('button', { name: /^Rotate/ }).textContent).toBe('Rotate (H)');
      await user.keyboard('r');
      expect(screen.getByRole('button', { name: /^Rotate/ }).textContent).toBe('Rotate (V)');
    });

    it('starts the game once the fleet is valid', async () => {
      await startGame(user);
      expect(screen.getByRole('region', { name: 'Enemy waters' })).toBeDefined();
      expect(banner()).toBe('Your turn - fire at the enemy waters');
    });
  });

  describe('gameplay', () => {
    beforeEach(async () => {
      await startGame(user);
    });

    it('hides unhit enemy ships and only reveals what has been shot', () => {
      const board = screen.getByRole('region', { name: 'Enemy waters' });
      expect(within(board).getAllByRole('button', { name: /water$/ })).toHaveLength(100);
    });

    it('keeps the turn after a hit and locks the fired cell', async () => {
      const target = aiShipCells[0] as Coord;
      await user.click(enemyCell(target));

      expect(enemyCell(target).getAttribute('aria-label')).toMatch(/(hit|sunk)$/);
      expect(enemyCell(target)).toHaveProperty('disabled', true);
      expect(banner()).toBe('Your turn - fire at the enemy waters');
    });

    it('hands the turn to the AI after a miss and returns it after an AI miss', async () => {
      await user.click(enemyCell(aiWaterCells[0] as Coord));
      expect(banner()).toBe('AI is thinking...');
      expect(aiLogEntries()).toHaveLength(0);

      let aiShots = 0;
      let sawStreakAfterHit = false;
      let sawHandoffAfterMiss = false;
      let previousWasHit = false;

      for (let step = 0; step < 40 && !(sawStreakAfterHit && sawHandoffAfterMiss); step += 1) {
        if (banner() === 'Your turn - fire at the enemy waters') {
          await user.click(enemyCell(aiWaterCells[step + 1] as Coord));
          previousWasHit = false;
          continue;
        }

        await aiTick();
        const entries = aiLogEntries();
        // Exactly one shot per tick, so a streak is visible rather than instantaneous.
        expect(entries).toHaveLength(aiShots + 1);
        aiShots = entries.length;

        const latest = entries[0] ?? '';
        const hit = /hit|sank/.test(latest);
        if (previousWasHit) sawStreakAfterHit = true;
        if (hit) {
          expect(banner()).toBe('AI is thinking...');
        } else {
          expect(banner()).toBe('Your turn - fire at the enemy waters');
          sawHandoffAfterMiss = true;
        }
        previousWasHit = hit;
      }

      expect(sawStreakAfterHit).toBe(true);
      expect(sawHandoffAfterMiss).toBe(true);
    });

    it('blocks the player while the AI holds the turn', async () => {
      await user.click(enemyCell(aiWaterCells[0] as Coord));
      expect(banner()).toBe('AI is thinking...');
      expect(enemyCell(aiWaterCells[1] as Coord)).toHaveProperty('disabled', true);
    });

    it('ends the game, blocks further fire and resets cleanly on Play again', async () => {
      for (const cell of aiShipCells) {
        await user.click(enemyCell(cell));
      }

      const dialog = screen.getByRole('dialog', { name: 'Game over' });
      expect(within(dialog).getByRole('heading', { name: 'You win' })).toBeDefined();
      expect(within(dialog).getByText('You 5/5')).toBeDefined();
      expect(enemyCell(aiWaterCells[0] as Coord)).toHaveProperty('disabled', true);

      await user.click(within(dialog).getByRole('button', { name: 'Play again' }));

      expect(screen.getByRole('heading', { name: 'Deploy your fleet' })).toBeDefined();
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(
        within(screen.getByRole('list', { name: 'Fleet' })).queryAllByText('Placed'),
      ).toHaveLength(0);
      expect(screen.getByRole('button', { name: 'Start game' })).toHaveProperty('disabled', true);
    });
  });
});

/** Guards the fixture assumptions the deterministic tests above rely on. */
it('has a seeded AI fleet of 17 cells', () => {
  expect(aiShipCells).toHaveLength(17);
  expect(applyAction(createInitialState(SEED), { type: 'START_GAME' }).ok).toBe(false);
});
