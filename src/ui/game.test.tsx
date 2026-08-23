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

const YOUR_TURN = 'Your turn — fire at the enemy waters';
const AI_TURN = 'AI is thinking';

/** The AI fleet for `SEED` is known up front, so hits and misses can be chosen deliberately. */
const aiBoard = createInitialState(SEED).boards.ai;
const aiShipCells = allCoords().filter((at) => shipAt(aiBoard, at) !== undefined);
const aiWaterCells = allCoords().filter((at) => shipAt(aiBoard, at) === undefined);

function cellIn(boardLabel: string, at: Coord): HTMLElement {
  const board = screen.getByRole('region', { name: boardLabel });
  return within(board).getByRole('button', { name: new RegExp(`^${coordLabel(at)}, `) });
}

function enemyCell(at: Coord): HTMLElement {
  return cellIn('Enemy waters', at);
}

function ownCell(at: Coord): HTMLElement {
  return cellIn('Your waters', at);
}

function banner(): string {
  return screen.getByTestId('turn-banner').textContent ?? '';
}

function hint(): string {
  return screen.getByTestId('validation-hint').textContent ?? '';
}

function announcement(): string {
  return screen.getByRole('status').textContent ?? '';
}

function isLocked(cell: HTMLElement): boolean {
  return cell.getAttribute('aria-disabled') === 'true';
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
      expect(hint()).toContain('Ship would extend off the board');
      expect(screen.getByTestId('validation-hint').dataset.tone).toBe('invalid');
    });

    it('names the blocking ship when a placement would overlap', async () => {
      await user.click(ownCell({ r: 0, c: 0 }));
      await user.hover(ownCell({ r: 0, c: 2 }));
      expect(hint()).toContain('Overlaps Carrier');
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

    it('places a ship with the keyboard and announces it', async () => {
      // Tab into the grid (one stop for the whole board), walk two cells right, place there.
      await user.tab();
      expect(document.activeElement).toBe(ownCell({ r: 0, c: 0 }));
      await user.keyboard('{ArrowRight}{ArrowRight}');
      expect(document.activeElement).toBe(ownCell({ r: 0, c: 2 }));
      await user.keyboard('{Enter}');

      expect(announcement()).toBe('Carrier placed at C1, horizontal');
      // C1..G1 now holds the Carrier; G1 is outside the preview that follows focus.
      expect(ownCell({ r: 0, c: 6 }).getAttribute('aria-label')).toBe('G1, your ship');
    });

    it('announces the reason when a click is rejected', async () => {
      await user.click(ownCell({ r: 0, c: 8 }));
      expect(announcement()).toBe('Ship would extend off the board');
      // Nothing was placed, and the cell still shows the rejected footprint under the cursor.
      expect(ownCell({ r: 0, c: 8 }).getAttribute('aria-label')).toBe('I1, invalid placement');
      expect(
        within(screen.getByRole('list', { name: 'Fleet' })).queryAllByText('Placed'),
      ).toHaveLength(0);
    });

    it('starts the game once the fleet is valid', async () => {
      await startGame(user);
      expect(screen.getByRole('region', { name: 'Enemy waters' })).toBeDefined();
      expect(banner()).toBe(YOUR_TURN);
    });
  });

  describe('gameplay', () => {
    beforeEach(async () => {
      await startGame(user);
    });

    it('hides unhit enemy ships and only reveals what has been shot', () => {
      const board = screen.getByRole('region', { name: 'Enemy waters' });
      expect(within(board).getAllByRole('button', { name: /, unknown$/ })).toHaveLength(100);
    });

    it('moves focus into the enemy grid when the battle starts', () => {
      expect(document.activeElement).toBe(enemyCell({ r: 0, c: 0 }));
    });

    it('keeps the turn after a hit and locks the fired cell', async () => {
      const target = aiShipCells[0] as Coord;
      await user.click(enemyCell(target));

      expect(enemyCell(target).getAttribute('aria-label')).toMatch(/, (hit|sunk)$/);
      expect(isLocked(enemyCell(target))).toBe(true);
      expect(banner()).toBe(YOUR_TURN);
      expect(announcement()).toMatch(/^You (hit|sank)/);
    });

    it('fires with the keyboard on the focused cell', async () => {
      const target = aiShipCells[0] as Coord;
      enemyCell(target).focus();
      await user.keyboard('{Enter}');

      expect(enemyCell(target).getAttribute('aria-label')).toMatch(/, (hit|sunk)$/);
    });

    it('hands the turn to the AI after a miss and returns it after an AI miss', async () => {
      await user.click(enemyCell(aiWaterCells[0] as Coord));
      expect(banner()).toContain(AI_TURN);
      expect(aiLogEntries()).toHaveLength(0);

      let aiShots = 0;
      let sawStreakAfterHit = false;
      let sawHandoffAfterMiss = false;
      let previousWasHit = false;

      for (let step = 0; step < 40 && !(sawStreakAfterHit && sawHandoffAfterMiss); step += 1) {
        if (banner() === YOUR_TURN) {
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
          expect(banner()).toContain(AI_TURN);
        } else {
          expect(banner()).toBe(YOUR_TURN);
          sawHandoffAfterMiss = true;
        }
        previousWasHit = hit;
      }

      expect(sawStreakAfterHit).toBe(true);
      expect(sawHandoffAfterMiss).toBe(true);
    });

    it('blocks the player while the AI holds the turn', async () => {
      await user.click(enemyCell(aiWaterCells[0] as Coord));
      expect(banner()).toContain(AI_TURN);
      expect(announcement()).toContain('AI is thinking.');
      expect(isLocked(enemyCell(aiWaterCells[1] as Coord))).toBe(true);
    });

    it('ends the game, blocks further fire and resets cleanly on Play again', async () => {
      for (const cell of aiShipCells) {
        await user.click(enemyCell(cell));
      }

      const dialog = screen.getByRole('dialog', { name: 'Game over' });
      expect(within(dialog).getByRole('heading', { name: 'You win' })).toBeDefined();
      expect(within(dialog).getByRole('row', { name: 'Ships sunk 5/5 0/5' })).toBeDefined();
      expect(announcement()).toContain('Game over. You win');
      // Focus is moved to the only remaining action.
      expect(document.activeElement).toBe(
        within(dialog).getByRole('button', { name: 'Play again' }),
      );
      expect(isLocked(enemyCell(aiWaterCells[0] as Coord))).toBe(true);

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
