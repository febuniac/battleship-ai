import { expect, test, type Locator, type Page } from '@playwright/test';
import { allCoords, coordLabel, shipAt } from '../src/engine/board.ts';
import { createInitialState } from '../src/engine/reducer.ts';
import type { Coord } from '../src/engine/types.ts';

/**
 * The app accepts `?seed=` and `?aiDelay=` (see `src/ui/urlOptions.ts`), which is the only
 * testing affordance needed here: the seed fixes the AI fleet, so this spec can compute the
 * enemy layout with the same engine the app runs and choose hits and misses deliberately,
 * and `aiDelay=0` removes the cosmetic pacing so every wait is a state assertion.
 */
const SEED = 20240617;
const URL = `/?seed=${SEED}&aiDelay=0`;

const aiBoard = createInitialState(SEED).boards.ai;
const shipCells = allCoords().filter((at) => shipAt(aiBoard, at) !== undefined);
const waterCells = allCoords().filter((at) => shipAt(aiBoard, at) === undefined);

const YOUR_TURN = /Your turn/;

function cell(page: Page, board: string, at: Coord): Locator {
  return page.getByRole('region', { name: board }).locator(`[data-coord="${coordLabel(at)}"]`);
}

function enemyCell(page: Page, at: Coord): Locator {
  return cell(page, 'Enemy waters', at);
}

async function startBattle(page: Page): Promise<void> {
  await page.goto(URL);
  await expect(page.getByRole('heading', { name: 'Deploy your fleet' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start game' })).toBeDisabled();

  await page.getByRole('button', { name: 'Randomize fleet' }).click();
  await expect(page.getByRole('button', { name: 'Start game' })).toBeEnabled();
  await page.getByRole('button', { name: 'Start game' }).click();

  await expect(page.getByRole('region', { name: 'Enemy waters' })).toBeVisible();
  await expect(page.getByTestId('turn-banner')).toHaveText(YOUR_TURN);
}

test('plays a seeded game from placement through victory back to a clean board', async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') {
      consoleErrors.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => consoleErrors.push(`pageerror: ${error.message}`));

  await startBattle(page);

  // A hit keeps the turn with the player.
  const firstHit = shipCells[0] as Coord;
  await enemyCell(page, firstHit).click();
  await expect(enemyCell(page, firstHit)).toHaveAttribute('data-state', /hit|sunk/);
  await expect(page.getByTestId('turn-banner')).toHaveText(YOUR_TURN);

  // A miss hands the turn to the AI, which then plays until it misses.
  const firstMiss = waterCells[0] as Coord;
  await enemyCell(page, firstMiss).click();
  await expect(enemyCell(page, firstMiss)).toHaveAttribute('data-state', 'miss');
  // The AI's shots land on the player's own water, and the contextual line reports the last one.
  await expect(
    page.getByRole('region', { name: 'Your waters' }).locator('[data-state="miss"]'),
  ).not.toHaveCount(0);
  await expect(page.getByTestId('status-line')).toContainText(/^AI /);
  await expect(page.getByTestId('turn-banner')).toHaveText(YOUR_TURN);

  // Sink the rest of the fleet. Every shot is a hit, so the turn never leaves the player.
  for (const at of shipCells.slice(1)) {
    await enemyCell(page, at).click();
  }

  const dialog = page.getByRole('dialog', { name: 'Game over' });
  await expect(dialog.getByRole('heading', { name: 'You win' })).toBeVisible();
  await expect(dialog.getByRole('row', { name: 'Ships sunk 5/5 0/5' })).toBeVisible();
  // The finished game is locked.
  await expect(enemyCell(page, waterCells[1] as Coord)).toHaveAttribute('aria-disabled', 'true');

  await dialog.getByRole('button', { name: 'Play again' }).click();
  await expect(page.getByRole('heading', { name: 'Deploy your fleet' })).toBeVisible();
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Start game' })).toBeDisabled();
  await expect(
    page.getByRole('region', { name: 'Your waters' }).locator('[data-state="your ship"]'),
  ).toHaveCount(0);

  expect(consoleErrors).toEqual([]);
});

test('is playable with the keyboard and announces what happened', async ({ page }) => {
  await startBattle(page);

  // Focus lands on the attack grid; arrows move within it and Enter fires.
  await expect(enemyCell(page, { r: 0, c: 0 })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowRight');
  await expect(enemyCell(page, { r: 1, c: 1 })).toBeFocused();
  await expect(enemyCell(page, { r: 1, c: 1 })).toHaveAttribute('aria-label', 'B2, unknown');

  await page.keyboard.press('Enter');
  await expect(enemyCell(page, { r: 1, c: 1 })).toHaveAttribute(
    'aria-label',
    /B2, (hit|miss|sunk)/,
  );
  // Both the visible status line and the live region reflect the shot; after a miss the AI
  // immediately answers, so either the player's shot or the AI's reply may be the latest event.
  await expect(page.getByTestId('status-line')).toContainText(/at B2|^AI /);
  await expect(page.getByRole('status')).toContainText(/at B2|Your turn|AI is thinking/);
});

test('fits a mobile viewport without horizontal scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await startBattle(page);

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);

  // Touch targets stay usable at this size.
  const box = await enemyCell(page, { r: 0, c: 0 }).boundingBox();
  expect(box?.width ?? 0).toBeGreaterThanOrEqual(24);
  const newGame = await page.getByRole('button', { name: 'New game' }).boundingBox();
  expect(newGame?.height ?? 0).toBeGreaterThanOrEqual(44);
});
