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

const YOUR_TURN = 'Your turn';
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

/** Decorative ship silhouettes drawn on a board, optionally filtered to one ship. */
function sprites(boardLabel: string, shipId?: string): SVGElement[] {
  const board = screen.getByRole('region', { name: boardLabel });
  return [...board.querySelectorAll<SVGElement>(`[data-ship${shipId ? `="${shipId}"` : ''}]`)];
}

function banner(): string {
  return screen.getByTestId('turn-banner').textContent ?? '';
}

/** The single contextual line: what just happened, or why a placement will not work. */
function status(): string {
  return screen.getByTestId('status-line').textContent ?? '';
}

/** Ships shown as placed in the tray, which no longer carries a textual badge. */
function placedShips(): string[] {
  const tray = screen.getByRole('list', { name: 'Fleet' });
  return [...tray.querySelectorAll<HTMLElement>('[data-placed="true"]')].map(
    (row) => row.dataset.shipRow ?? '',
  );
}

function announcement(): string {
  return screen.getByRole('status').textContent ?? '';
}

function isLocked(cell: HTMLElement): boolean {
  return cell.getAttribute('aria-disabled') === 'true';
}

/** Shots the AI has resolved, counted off the player's own water rather than a log panel. */
function aiShotCount(): number {
  const board = screen.getByRole('region', { name: 'Your waters' });
  return [...board.querySelectorAll<HTMLElement>('[data-state]')].filter((cell) =>
    ['miss', 'hit', 'sunk'].includes(cell.dataset.state ?? ''),
  ).length;
}

/** Let exactly one paced AI shot resolve. */
async function aiTick(): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(AI_DELAY);
  });
}

async function startGame(user: UserEvent): Promise<void> {
  await user.click(screen.getByRole('button', { name: 'Randomize fleet' }));
  await user.click(screen.getByRole('button', { name: 'Begin battle' }));
}

describe('Battleship app', () => {
  let user: UserEvent;

  beforeEach(async () => {
    // `shouldAdvanceTime` keeps user-event's own waits working under fake timers.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<App seed={SEED} aiDelayMs={AI_DELAY} />);
    await user.click(screen.getByRole('button', { name: 'Start game' }));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('placement', () => {
    it('renders an empty board and the full ship tray', () => {
      expect(screen.getByRole('heading', { name: 'Deploy your fleet' })).toBeDefined();
      const tray = screen.getByRole('list', { name: 'Fleet' });
      expect(within(tray).getAllByRole('listitem')).toHaveLength(5);
      expect(placedShips()).toHaveLength(0);
    });

    it('reports the engine reason when a placement would leave the board', async () => {
      await user.hover(ownCell({ r: 0, c: 7 }));
      expect(status()).toContain('Ship would extend off the board');
      expect(screen.getByTestId('status-line').dataset.tone).toBe('invalid');
    });

    it('names the blocking ship when a placement would overlap', async () => {
      await user.click(ownCell({ r: 0, c: 0 }));
      await user.hover(ownCell({ r: 0, c: 2 }));
      expect(status()).toContain('Overlaps Carrier');
    });

    it('keeps Begin battle disabled until all five ships are placed', async () => {
      const start = screen.getByRole('button', { name: 'Begin battle' });
      expect(start).toHaveProperty('disabled', true);

      await user.click(ownCell({ r: 0, c: 0 }));
      expect(start).toHaveProperty('disabled', true);

      await user.click(screen.getByRole('button', { name: 'Randomize fleet' }));
      expect(start).toHaveProperty('disabled', false);
    });

    it('removes a placed ship when its cell is clicked again', async () => {
      await user.click(ownCell({ r: 0, c: 0 }));
      expect(placedShips()).toEqual(['carrier']);

      await user.click(ownCell({ r: 0, c: 0 }));
      expect(placedShips()).toHaveLength(0);
    });

    it('rotates with the R shortcut', async () => {
      await user.keyboard('r');
      expect(announcement()).toBe('Orientation vertical');
      await user.keyboard('r');
      expect(announcement()).toBe('Orientation horizontal');
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
      expect(placedShips()).toHaveLength(0);
    });

    it('starts the game once the fleet is valid', async () => {
      await startGame(user);
      expect(screen.getByRole('region', { name: 'Enemy waters' })).toBeDefined();
      expect(banner()).toBe(YOUR_TURN);
    });
  });

  describe('ship visuals', () => {
    it('draws one silhouette per placed ship, spanning its cells', async () => {
      await user.click(ownCell({ r: 0, c: 0 }));

      const [carrier] = sprites('Your waters', 'carrier');
      expect(carrier?.getAttribute('viewBox')).toBe('0 0 100 20');
      // The drawing is decorative: the cells remain the only announced, interactive layer.
      expect(carrier?.getAttribute('aria-hidden')).toBe('true');
      expect(carrier?.parentElement?.style.gridColumn).toBe('1 / span 5');
      expect(carrier?.parentElement?.style.gridRow).toBe('1');
    });

    it('turns the silhouette itself when the orientation changes', async () => {
      await user.keyboard('r');
      await user.click(ownCell({ r: 0, c: 0 }));

      const [carrier] = sprites('Your waters', 'carrier');
      expect(carrier?.getAttribute('viewBox')).toBe('0 0 20 100');
      expect(carrier?.parentElement?.style.gridRow).toBe('1 / span 5');
    });

    it('ghosts a valid preview and marks a rejected one', async () => {
      await user.hover(ownCell({ r: 4, c: 0 }));
      expect(sprites('Your waters', 'carrier')[0]?.classList.contains('ship-tone-ghost')).toBe(
        true,
      );

      await user.click(ownCell({ r: 4, c: 0 }));
      await user.hover(ownCell({ r: 4, c: 2 }));
      const overlapping = sprites('Your waters', 'battleship')[0];
      expect(overlapping?.classList.contains('ship-tone-invalid')).toBe(true);
    });

    it('draws no enemy silhouette until a ship is sunk', async () => {
      await startGame(user);
      expect(sprites('Enemy waters')).toHaveLength(0);

      const carrier = aiBoard.ships.find((ship) => ship.id === 'carrier');
      for (const cell of carrier?.cells ?? []) {
        await user.click(enemyCell(cell));
      }

      const revealed = sprites('Enemy waters');
      expect(revealed).toHaveLength(1);
      expect(revealed[0]?.dataset.ship).toBe('carrier');
      expect(revealed[0]?.classList.contains('ship-tone-wreck')).toBe(true);
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
      expect(aiShotCount()).toBe(0);

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
        // Exactly one shot per tick, so a streak is visible rather than instantaneous.
        expect(aiShotCount()).toBe(aiShots + 1);
        aiShots = aiShotCount();

        // The contextual line is the only running commentary now that the log panel is gone.
        const latest = status();
        expect(latest).toMatch(/^AI /);
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
      expect(placedShips()).toHaveLength(0);
      expect(screen.getByRole('button', { name: 'Begin battle' })).toHaveProperty('disabled', true);
    });
  });
});

describe('opening screen', () => {
  it('greets a fresh visitor and hands over to placement on Start game', async () => {
    const user = userEvent.setup();
    render(<App seed={SEED} />);

    expect(screen.getByRole('heading', { level: 1, name: 'Battleship' })).toBeDefined();
    expect(screen.getByText('Sink the enemy fleet before they sink yours.')).toBeDefined();
    expect(screen.queryByRole('list', { name: 'Fleet' })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Start game' }));

    expect(screen.getByRole('heading', { name: 'Deploy your fleet' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Begin battle' })).toHaveProperty('disabled', true);
  });

  it('opens the rules in a modal and closes it with Escape, returning focus', async () => {
    const user = userEvent.setup();
    render(<App seed={SEED} />);

    const trigger = screen.getByRole('button', { name: 'The rules' });
    await user.click(trigger);

    const dialog = screen.getByRole('dialog', { name: 'The rules' });
    expect(within(dialog).getByRole('heading', { name: 'Take turns' })).toBeDefined();
    expect(within(dialog).getByText(/Carrier/)).toBeDefined();
    expect(within(dialog).getByText('Ships may touch.')).toBeDefined();
    expect(document.activeElement).toBe(
      within(dialog).getByRole('button', { name: 'Close the rules' }),
    );

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(trigger);
    // The rules are informational only: the game has not started.
    expect(screen.getByRole('button', { name: 'Start game' })).toBeDefined();
  });
});

/** Guards the fixture assumptions the deterministic tests above rely on. */
it('has a seeded AI fleet of 17 cells', () => {
  expect(aiShipCells).toHaveLength(17);
  expect(applyAction(createInitialState(SEED), { type: 'START_GAME' }).ok).toBe(false);
});
