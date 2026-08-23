import { act, render, screen, within } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { allCoords, coordLabel, shipAt } from '../engine/board.ts';
import { applyAction, createInitialState } from '../engine/reducer.ts';
import { shipSpec } from '../engine/rules.ts';
import type { Coord } from '../engine/types.ts';
import { App } from './App.tsx';
import { IDLE_PROMPT_MS } from './useIdlePrompt.ts';

const SEED = 20240617;
// Long enough that the shared clock never fires a shot on its own: every AI shot in these
// tests is stepped explicitly by `aiTick`.
const AI_DELAY = 50_000;

const YOUR_TURN = 'Your turn';
const AI_TURN = "AI's turn";

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

function trayRow(shipId: string): HTMLElement {
  const tray = screen.getByRole('list', { name: 'Fleet' });
  const row = tray.querySelector<HTMLElement>(`[data-ship-row="${shipId}"]`);
  if (row === null) throw new Error(`no tray row for ${shipId}`);
  return row;
}

/**
 * Where a ship sits on the water, read off its silhouette: the grid area encodes origin, length
 * and orientation, so comparing it detects any move, rotation or removal.
 */
function shipArea(shipId: string): string {
  const sprite = sprites('Your waters', shipId)[0];
  const layer = sprite?.parentElement;
  if (layer == null) return 'absent';
  return `${layer.style.gridColumn} / ${layer.style.gridRow}`;
}

function ownShipCells(): string[] {
  const board = screen.getByRole('region', { name: 'Your waters' });
  return [...board.querySelectorAll<HTMLElement>('[data-coord]')]
    .filter((cell) => (cell.getAttribute('aria-label') ?? '').endsWith('your ship'))
    .map((cell) => cell.dataset.coord ?? '');
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

/** Let a landed result finish its beat on the board, so the boards go back to narrating the turn. */
async function settleResult(): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1_000);
  });
}

/** Sit out the idle-turn wait, with a little slack so the timer has certainly fired. */
async function idleWait(): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(IDLE_PROMPT_MS + 100);
  });
}

function idlePrompt(): HTMLElement | null {
  return screen.queryByTestId('idle-prompt');
}

/** Cells currently playing the “this hull went down” animation on a board. */
function sinkingCells(boardLabel: string): string[] {
  const board = screen.getByRole('region', { name: boardLabel });
  return [...board.querySelectorAll<HTMLElement>('.animate-shot-sunk')].map(
    (cell) => cell.dataset.coord ?? '',
  );
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
  // The battle opens on its one-time introduction; the tests play the game behind it.
  await user.click(screen.getByRole('button', { name: 'Start attack' }));
}

describe('Battleship app', () => {
  let user: UserEvent;

  beforeEach(async () => {
    // `shouldAdvanceTime` keeps user-event's own waits working under fake timers.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<App seed={SEED} aiDelayMs={AI_DELAY} />);
    await user.click(screen.getByRole('button', { name: 'Start game' }));
    await user.click(screen.getByRole('button', { name: 'Got it' }));
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

    it('tells a first-time player what to do and what the fleet numbers mean', () => {
      expect(screen.getByTestId('board-hud-friendly').textContent).toBe(
        'Tap a ship below, then tap the board to place it.',
      );
      const tray = screen.getByRole('list', { name: 'Fleet' });
      expect(tray.textContent).toContain('5 cells');
      expect(tray.textContent).toContain('2 cells');
    });

    it('narrates placement inside the board, from selection to a ready fleet', async () => {
      const hud = () => screen.getByTestId('board-hud-friendly');

      await user.click(trayRow('battleship'));
      expect(hud().textContent).toBe('Now tap the board to place it.');

      await user.hover(ownCell({ r: 4, c: 0 }));
      expect(hud().textContent).toBe('Place Battleship here.');
      expect(hud().dataset.tone).toBe('valid');

      await user.hover(ownCell({ r: 4, c: 8 }));
      expect(hud().textContent).toBe('That position is unavailable.');
      expect(hud().dataset.tone).toBe('invalid');

      await user.click(ownCell({ r: 4, c: 0 }));
      await user.unhover(ownCell({ r: 4, c: 0 }));
      // The next ship is already in hand, so the instruction is the next move, not a receipt.
      expect(hud().textContent).toBe('Now tap the board to place it.');
      expect(status()).toBe('Battleship placed');

      await user.click(screen.getByRole('button', { name: 'Randomize fleet' }));
      expect(hud().textContent).toBe('Fleet ready. Begin battle.');
    });

    it('keeps the board instruction inside the water, above the grid', () => {
      const water = screen.getByRole('region', { name: 'Your waters' }).querySelector('.ocean');
      const hud = screen.getByTestId('board-hud-friendly');
      expect(water?.contains(hud)).toBe(true);
      // The grid follows the instruction rather than sitting under it.
      expect(hud.compareDocumentPosition(ownCell({ r: 0, c: 0 }))).toBe(
        Node.DOCUMENT_POSITION_FOLLOWING,
      );
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

    it('picks a placed ship back up from the tray', async () => {
      await user.click(ownCell({ r: 0, c: 0 }));
      expect(placedShips()).toEqual(['carrier']);

      await user.click(trayRow('carrier'));
      expect(placedShips()).toHaveLength(0);
      expect(announcement()).toBe('Carrier selected');
    });

    it('picks a placed ship back up from the board once nothing is pending', async () => {
      await user.click(screen.getByRole('button', { name: 'Randomize fleet' }));
      expect(placedShips()).toHaveLength(5);

      const board = screen.getByRole('region', { name: 'Your waters' });
      const occupied = within(board).getAllByRole('button', { name: /, your ship$/ })[0];
      if (occupied === undefined) throw new Error('expected a randomized fleet');
      await user.click(occupied);

      expect(placedShips()).toHaveLength(4);
      expect(announcement()).toContain('removed');
    });

    /*
     * An invalid placement must be atomic: the engine's rejection has to leave the board exactly
     * as it was, including the ship the player was trying to overlap.
     */
    describe('rejecting an invalid placement', () => {
      /** Every legal shape of rejection, each aimed at the placed Carrier or the board edge. */
      const cases = [
        { name: 'fully overlapping a horizontal ship', at: { r: 0, c: 0 }, rotate: false },
        { name: 'partially overlapping a horizontal ship', at: { r: 0, c: 3 }, rotate: false },
        { name: 'crossing a horizontal ship at right angles', at: { r: 0, c: 2 }, rotate: true },
        { name: 'running off the board', at: { r: 5, c: 8 }, rotate: false },
      ] as const;

      for (const { name, at, rotate } of cases) {
        it(`keeps the fleet intact when ${name}`, async () => {
          // Carrier at A1..E1, horizontal.
          await user.click(ownCell({ r: 0, c: 0 }));
          const carrierBefore = shipArea('carrier');
          expect(carrierBefore).toBe('1 / span 5 / 1');
          // Placing the Carrier advanced the selection to the Battleship.
          expect(trayRow('battleship').getAttribute('aria-pressed')).toBe('true');

          if (rotate) await user.keyboard('r');
          await user.click(ownCell(at));

          // The rejected ship is not placed and the Carrier is untouched, orientation included.
          expect(placedShips()).toEqual(['carrier']);
          expect(shipArea('carrier')).toBe(carrierBefore);
          expect(status()).toMatch(/Overlaps Carrier|extend off the board/);
          // The rejected footprint marks the cells under the cursor; the Carrier is whole again
          // as soon as the cursor leaves.
          await user.unhover(ownCell(at));
          expect(ownShipCells()).toEqual(['A1', 'B1', 'C1', 'D1', 'E1']);
          // The Battleship is still the ship being placed, so another position can be tried.
          expect(trayRow('battleship').getAttribute('aria-pressed')).toBe('true');

          if (rotate) await user.keyboard('r');
          await user.click(ownCell({ r: 5, c: 0 }));
          expect(placedShips()).toEqual(['carrier', 'battleship']);
          expect(shipArea('carrier')).toBe(carrierBefore);
          expect(shipArea('battleship')).toBe('1 / span 4 / 6');
        });
      }

      it('keeps a vertical ship intact when a placement crosses it', async () => {
        // Carrier at A1..A5, vertical.
        await user.keyboard('r');
        await user.click(ownCell({ r: 0, c: 0 }));
        expect(shipArea('carrier')).toBe('1 / 1 / span 5');

        // Back to horizontal, then straight through the Carrier's third cell.
        await user.keyboard('r');
        await user.click(ownCell({ r: 2, c: 0 }));

        expect(placedShips()).toEqual(['carrier']);
        expect(shipArea('carrier')).toBe('1 / 1 / span 5');
        expect(status()).toContain('Overlaps Carrier');
        await user.unhover(ownCell({ r: 2, c: 0 }));
        expect(ownShipCells()).toEqual(['A1', 'A2', 'A3', 'A4', 'A5']);
      });
    });

    it('rotates with the R shortcut', async () => {
      await user.keyboard('r');
      expect(announcement()).toBe('Orientation vertical');
      await user.keyboard('r');
      expect(announcement()).toBe('Orientation horizontal');
    });

    it('rotates from a visible control that shows the current direction', async () => {
      const rotateButton = () => screen.getByRole('button', { name: /^Rotate ship/ });
      expect(rotateButton().dataset.orientation).toBe('horizontal');

      await user.click(rotateButton());
      expect(rotateButton().dataset.orientation).toBe('vertical');
      expect(announcement()).toBe('Orientation vertical');

      await user.click(ownCell({ r: 0, c: 0 }));
      expect(shipArea('carrier')).toBe('1 / 1 / span 5');
    });

    it('marks the selected ship in the tray and moves the mark on to the next one', async () => {
      await user.click(trayRow('destroyer'));
      expect(trayRow('destroyer').dataset.selected).toBe('true');
      expect(trayRow('carrier').dataset.selected).toBe('false');

      await user.click(ownCell({ r: 9, c: 0 }));
      expect(trayRow('destroyer').dataset.selected).toBe('false');
      expect(trayRow('carrier').dataset.selected).toBe('true');
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

    it('bursts over a hull only on the shot that sinks it', async () => {
      await startGame(user);
      const bursts = () =>
        within(screen.getByRole('region', { name: 'Enemy waters' })).queryAllByTestId('sink-burst');

      const ship = shipAt(aiBoard, aiShipCells[0] as Coord);
      if (ship === undefined) throw new Error('expected a ship on the seeded enemy board');

      for (const cell of ship.cells.slice(0, -1)) {
        await user.click(enemyCell(cell));
        expect(bursts()).toHaveLength(0);
      }

      await user.click(enemyCell(ship.cells.at(-1) as Coord));
      expect(bursts()).toHaveLength(1);
      expect(
        bursts()[0]?.parentElement?.querySelector('[data-ship]')?.getAttribute('data-ship'),
      ).toBe(ship.id);
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

    it('points a first-time player at the enemy board', () => {
      expect(screen.getByTestId('board-hud-enemy').textContent).toBe('Select where to attack.');
      expect(screen.getByTestId('board-hud-friendly').textContent).toBe('The AI fires here.');
    });

    it('names the square under the cursor, then what the shot did', async () => {
      const hud = () => screen.getByTestId('board-hud-enemy');
      const water = aiWaterCells[0] as Coord;

      await user.hover(enemyCell(water));
      expect(hud().textContent).toBe(`Fire at ${coordLabel(water)}`);

      await user.click(enemyCell(water));
      expect(hud().textContent).toBe('MISS');

      // The result has its own beat; then the locked board explains the wait.
      await settleResult();
      expect(hud().textContent).toBe('AI is thinking…');
      expect(screen.getByTestId('board-hud-friendly').textContent).toBe('AI is thinking…');
    });

    it('names an enemy ship only once it goes down', async () => {
      const hud = () => screen.getByTestId('board-hud-enemy');
      const ship = shipAt(aiBoard, aiShipCells[0] as Coord);
      if (ship === undefined) throw new Error('expected a ship on the seeded enemy board');

      for (const [index, cell] of ship.cells.entries()) {
        await user.click(enemyCell(cell));
        await user.unhover(enemyCell(cell));
        const afloat = index < ship.cells.length - 1;
        expect(hud().textContent).toBe(
          afloat ? 'HIT' : `${shipSpec(ship.id).name.toUpperCase()} SUNK`,
        );
        expect(hud().dataset.tone).toBe('impact');
      }
    });

    it('names the outcome of a shot without naming an enemy ship still afloat', async () => {
      await user.click(enemyCell(aiShipCells[0] as Coord));
      expect(status()).toMatch(/^(HIT · [A-J]\d+|SUNK · \w+)$/);
      expect(screen.getByTestId('status-line').dataset.tone).toBe('impact');

      await user.click(enemyCell(aiWaterCells[0] as Coord));
      expect(status()).toMatch(/^MISS · [A-J]\d+$/);
      expect(screen.getByTestId('status-line').dataset.tone).toBe('neutral');
    });

    it('marks a hit as an impact rather than a cross', async () => {
      const target = aiShipCells[0] as Coord;
      await user.click(enemyCell(target));

      const mark = enemyCell(target).querySelector('svg');
      // An impact point inside a shock ring, with fragments thrown clear — not a cross.
      expect(mark?.querySelectorAll('circle')).toHaveLength(2);
      expect(mark?.querySelectorAll('path')).toHaveLength(1);

      await user.click(enemyCell(aiWaterCells[0] as Coord));
      // Water keeps its plain ripple, so the two outcomes never look alike.
      const splash = enemyCell(aiWaterCells[0] as Coord).querySelector('svg');
      expect(splash?.querySelectorAll('path')).toHaveLength(0);
    });

    it('moves the emphasis to whichever water is in play', async () => {
      const water = (label: string) =>
        screen
          .getByRole('region', { name: label })
          .querySelector('.ocean')
          ?.getAttribute('data-emphasis');

      expect([water('Enemy waters'), water('Your waters')]).toEqual(['active', 'idle']);

      await user.click(enemyCell(aiWaterCells[0] as Coord));

      expect(banner()).toContain(AI_TURN);
      expect(banner()).toContain('AI is thinking');
      expect([water('Enemy waters'), water('Your waters')]).toEqual(['idle', 'active']);
      // The board that cannot be fired at stops asking for a target.
      await settleResult();
      expect(screen.getByTestId('board-hud-enemy').textContent).toBe('AI is thinking…');
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

    it('names a sunk hull on the water, and says nothing on a plain hit', async () => {
      const notice = () => screen.queryByTestId('sunk-notice-human');
      const ship = shipAt(aiBoard, aiShipCells[0] as Coord);
      if (ship === undefined) throw new Error('expected a ship on the seeded enemy board');

      for (const cell of ship.cells.slice(0, -1)) {
        await user.click(enemyCell(cell));
        // A hit is not a sinking: no notice, and only the struck square animates.
        expect(notice()).toBeNull();
        expect(sinkingCells('Enemy waters')).toHaveLength(0);
      }

      await user.click(enemyCell(ship.cells.at(-1) as Coord));

      expect(notice()?.textContent).toBe(`${shipSpec(ship.id).name.toUpperCase()} SUNK`);
      // The whole hull is highlighted, not just the square that finished it.
      expect(sinkingCells('Enemy waters').sort()).toEqual(
        ship.cells.map((cell) => coordLabel(cell)).sort(),
      );
      // Nothing to dismiss: the next shot lands while the notice is still up.
      const next = aiWaterCells[0] as Coord;
      await user.click(enemyCell(next));
      expect(enemyCell(next).getAttribute('aria-label')).toMatch(/, miss$/);

      // The news keeps its beat, then the board goes back to narrating the turn.
      await settleResult();
      expect(notice()).toBeNull();
    });

    it("says the turn is still the player's after a hit", async () => {
      const hud = () => screen.getByTestId('board-hud-enemy');
      const target = aiShipCells[0] as Coord;

      await user.click(enemyCell(target));
      await user.unhover(enemyCell(target));
      await settleResult();

      expect(hud().textContent).toBe('Your turn • Keep firing!');
      expect(banner()).toBe(YOUR_TURN);
      // And the invitation still names a square once the player aims at one.
      const next = aiWaterCells[0] as Coord;
      await user.hover(enemyCell(next));
      expect(hud().textContent).toBe(`Fire at ${coordLabel(next)}`);
    });

    it('points out an idle turn, and stops as soon as the player acts', async () => {
      expect(idlePrompt()).toBeNull();

      await idleWait();
      expect(idlePrompt()?.textContent).toBe("You're up! Make your next move.");
      // A nudge, not a gate: the board underneath is still live.
      expect(isLocked(enemyCell(aiWaterCells[0] as Coord))).toBe(false);

      await user.hover(enemyCell(aiWaterCells[0] as Coord));
      expect(idlePrompt()).toBeNull();
    });

    it('restarts the idle wait on every shot the player takes', async () => {
      const ship = shipAt(aiBoard, aiShipCells[0] as Coord);
      if (ship === undefined) throw new Error('expected a ship on the seeded enemy board');

      await act(async () => {
        await vi.advanceTimersByTimeAsync(IDLE_PROMPT_MS - 5_000);
      });
      expect(idlePrompt()).toBeNull();

      // A hit keeps the turn, so the wait starts over rather than expiring mid-streak.
      await user.click(enemyCell(ship.cells[0] as Coord));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(IDLE_PROMPT_MS - 5_000);
      });
      expect(idlePrompt()).toBeNull();

      await idleWait();
      expect(idlePrompt()).not.toBeNull();
    });

    it('never points out a turn the player does not have', async () => {
      await user.click(enemyCell(aiWaterCells[0] as Coord));
      expect(banner()).toContain(AI_TURN);

      await idleWait();
      expect(idlePrompt()).toBeNull();
    });

    it('stays quiet once the game is over', async () => {
      for (const cell of aiShipCells) {
        await user.click(enemyCell(cell));
      }
      expect(screen.getByRole('dialog', { name: 'Game over' })).toBeDefined();

      await idleWait();
      expect(idlePrompt()).toBeNull();
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
        const hit = /HIT|SUNK/.test(latest);
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

    it('asks before throwing a game away, and Cancel changes nothing', async () => {
      const target = aiShipCells[0] as Coord;
      await user.click(enemyCell(target));
      const shotsBefore = aiShotCount();

      const newGame = screen.getByRole('button', { name: 'New game' });
      await user.click(newGame);

      const dialog = screen.getByRole('dialog', { name: 'Start a new game?' });
      expect(within(dialog).getByText('Your current game will be lost.')).toBeDefined();
      // Opening the dialog is inert: same turn, same shots, same board.
      expect(banner()).toBe(YOUR_TURN);
      expect(enemyCell(target).getAttribute('aria-label')).toMatch(/, (hit|sunk)$/);
      expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: 'Cancel' }));

      await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));

      expect(screen.queryByRole('dialog')).toBeNull();
      expect(document.activeElement).toBe(newGame);
      expect(banner()).toBe(YOUR_TURN);
      expect(aiShotCount()).toBe(shotsBefore);
      expect(enemyCell(target).getAttribute('aria-label')).toMatch(/, (hit|sunk)$/);
      expect(screen.getByRole('region', { name: 'Enemy waters' })).toBeDefined();
    });

    it('closes the confirmation with Escape and keeps the game', async () => {
      const target = aiShipCells[0] as Coord;
      await user.click(enemyCell(target));
      await user.click(screen.getByRole('button', { name: 'New game' }));
      await user.keyboard('{Escape}');

      expect(screen.queryByRole('dialog')).toBeNull();
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'New game' }));
      expect(enemyCell(target).getAttribute('aria-label')).toMatch(/, (hit|sunk)$/);
    });

    it('resets to a clean placement screen once the new game is confirmed', async () => {
      await user.click(enemyCell(aiShipCells[0] as Coord));
      await user.click(screen.getByRole('button', { name: 'New game' }));
      const dialog = screen.getByRole('dialog', { name: 'Start a new game?' });
      await user.click(within(dialog).getByRole('button', { name: 'New game' }));

      expect(screen.queryByRole('dialog')).toBeNull();
      expect(screen.getByRole('heading', { name: 'Deploy your fleet' })).toBeDefined();
      expect(placedShips()).toHaveLength(0);
      // Placement, not the opening screen.
      expect(screen.queryByText('Sink the enemy fleet before they sink yours.')).toBeNull();
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
      // The board is no longer actionable: it names the vessel that ended the game instead.
      expect(screen.getByTestId('board-hud-enemy').textContent).toMatch(/ SUNK$|^Game over\.$/);
      expect(screen.queryByText('Select where to attack.')).toBeNull();

      await user.click(within(dialog).getByRole('button', { name: 'Play again' }));

      expect(screen.getByRole('heading', { name: 'Deploy your fleet' })).toBeDefined();
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(placedShips()).toHaveLength(0);
      expect(screen.getByRole('button', { name: 'Begin battle' })).toHaveProperty('disabled', true);
    });
  });
});

describe('stage introductions', () => {
  let user: UserEvent;

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<App seed={SEED} aiDelayMs={AI_DELAY} />);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('invites the player into placement over their own board, once', async () => {
    await user.click(screen.getByRole('button', { name: 'Start game' }));

    const intro = screen.getByRole('dialog', { name: 'Place your fleet' });
    // The invitation belongs to the water it explains, not to the page.
    expect(screen.getByRole('region', { name: 'Your waters' }).contains(intro)).toBe(true);
    expect(
      within(intro).getByText(
        'Tap a ship below, then tap the board to place it. Tap rotate to change direction.',
      ),
    ).toBeDefined();
    const cta = within(intro).getByRole('button', { name: 'Got it' });
    expect(document.activeElement).toBe(cta);
    // Placement is not on offer yet.
    expect(isLocked(ownCell({ r: 0, c: 0 }))).toBe(true);

    await user.keyboard('{Enter}');

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByTestId('board-hud-friendly').textContent).toBe(
      'Tap a ship below, then tap the board to place it.',
    );
    expect(isLocked(ownCell({ r: 0, c: 0 }))).toBe(false);

    await user.click(ownCell({ r: 0, c: 0 }));
    expect(placedShips()).toEqual(['carrier']);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('invites the first attack over the enemy board, then never again', async () => {
    await user.click(screen.getByRole('button', { name: 'Start game' }));
    await user.click(screen.getByRole('button', { name: 'Got it' }));
    await user.click(screen.getByRole('button', { name: 'Randomize fleet' }));
    await user.click(screen.getByRole('button', { name: 'Begin battle' }));

    const intro = screen.getByRole('dialog', { name: 'Choose your target' });
    expect(screen.getByRole('region', { name: 'Enemy waters' }).contains(intro)).toBe(true);
    expect(within(intro).getByText('Select a position to attack')).toBeDefined();
    const cta = within(intro).getByRole('button', { name: 'Start attack' });
    expect(document.activeElement).toBe(cta);
    expect(isLocked(enemyCell(aiWaterCells[0] as Coord))).toBe(true);

    await user.click(cta);

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByTestId('board-hud-enemy').textContent).toBe('Select where to attack.');

    // A miss hands the turn over and back; neither transition brings the invitation back.
    await user.click(enemyCell(aiWaterCells[0] as Coord));
    expect(screen.queryByRole('dialog')).toBeNull();
    await settleResult();
    await aiTick();
    expect(screen.queryByRole('dialog')).toBeNull();

    await user.click(enemyCell(aiShipCells[0] as Coord));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('does not repeat either invitation on a second game', async () => {
    await user.click(screen.getByRole('button', { name: 'Start game' }));
    await user.click(screen.getByRole('button', { name: 'Got it' }));
    await user.click(screen.getByRole('button', { name: 'Randomize fleet' }));
    await user.click(screen.getByRole('button', { name: 'Begin battle' }));
    await user.click(screen.getByRole('button', { name: 'Start attack' }));

    for (const cell of aiShipCells) {
      await user.click(enemyCell(cell));
    }
    const over = screen.getByRole('dialog', { name: 'Game over' });
    await user.click(within(over).getByRole('button', { name: 'Play again' }));

    // Placement again, straight into the interaction.
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(isLocked(ownCell({ r: 0, c: 0 }))).toBe(false);

    await user.click(screen.getByRole('button', { name: 'Randomize fleet' }));
    await user.click(screen.getByRole('button', { name: 'Begin battle' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByTestId('board-hud-enemy').textContent).toBe('Select where to attack.');
  });
});

/**
 * The same placement screen on a screen that cannot hover. A tap has to do the aiming a pointer
 * does by moving, so it previews first and only commits on a second tap or from the button.
 */
describe('placement on a touch screen', () => {
  let user: UserEvent;

  beforeEach(async () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query === '(hover: none)',
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }));
    user = userEvent.setup();
    render(<App seed={SEED} aiDelayMs={AI_DELAY} />);
    await user.click(screen.getByRole('button', { name: 'Start game' }));
    await user.click(screen.getByRole('button', { name: 'Got it' }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('previews the ship on the first tap and places it on the second', async () => {
    const hud = () => screen.getByTestId('board-hud-friendly');

    await user.click(ownCell({ r: 2, c: 1 }));
    // Nothing is committed yet: the footprint is only drawn on the water.
    expect(placedShips()).toHaveLength(0);
    expect(ownCell({ r: 2, c: 1 }).getAttribute('aria-label')).toBe('B3, valid placement');
    expect(hud().textContent).toBe('Tap again to place your Carrier.');

    await user.click(ownCell({ r: 2, c: 1 }));
    expect(placedShips()).toEqual(['carrier']);
    expect(shipArea('carrier')).toBe('2 / span 5 / 3');
  });

  it('moves the preview to whichever square is tapped next', async () => {
    await user.click(ownCell({ r: 2, c: 1 }));
    await user.click(ownCell({ r: 5, c: 0 }));
    expect(placedShips()).toHaveLength(0);
    expect(ownCell({ r: 2, c: 1 }).getAttribute('aria-label')).toBe('B3, unknown');

    await user.click(ownCell({ r: 5, c: 0 }));
    expect(shipArea('carrier')).toBe('1 / span 5 / 6');
  });

  it('rotates the pending preview in place before it is committed', async () => {
    await user.click(ownCell({ r: 0, c: 0 }));
    await user.click(screen.getByRole('button', { name: /^Rotate ship/ }));
    expect(ownCell({ r: 4, c: 0 }).getAttribute('aria-label')).toBe('A5, valid placement');

    await user.click(screen.getByTestId('confirm-placement'));
    expect(shipArea('carrier')).toBe('1 / 1 / span 5');
  });

  it('offers the placement as a button, and refuses a position the engine rejects', async () => {
    await user.click(ownCell({ r: 0, c: 0 }));
    expect(screen.getByTestId('confirm-placement').textContent).toBe('Place Carrier at A1');
    await user.click(screen.getByTestId('confirm-placement'));
    expect(placedShips()).toEqual(['carrier']);

    // The Battleship is in hand now; A1 is taken, so the offer states it cannot be used.
    await user.click(ownCell({ r: 0, c: 0 }));
    const confirm = screen.getByTestId('confirm-placement');
    expect(confirm.textContent).toBe('That position is unavailable');
    expect(confirm).toHaveProperty('disabled', true);
    expect(placedShips()).toEqual(['carrier']);
  });
});

describe('opening screen', () => {
  it('greets a fresh visitor and hands over to placement on Start game', async () => {
    const user = userEvent.setup();
    render(<App seed={SEED} />);

    expect(screen.getByRole('heading', { level: 1, name: 'Battleship' })).toBeDefined();
    expect(screen.getByText('Sink the enemy fleet before they sink yours.')).toBeDefined();
    // A first-time player learns the objective and how turns work without opening the rules.
    expect(screen.getByRole('heading', { name: 'How to play' })).toBeDefined();
    expect(
      screen.getByText(
        'Place your fleet. Take turns firing at the enemy. Hit all five ships to win.',
      ),
    ).toBeDefined();
    expect(screen.getByText('Hit = fire again · Miss = turn changes')).toBeDefined();
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
