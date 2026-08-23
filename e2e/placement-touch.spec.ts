import { expect, test, type Page } from '@playwright/test';
import { coordLabel } from '../src/engine/board.ts';
import type { Coord } from '../src/engine/types.ts';

/**
 * Placement on a phone, driven by taps only: the pointer is never moved, so nothing here can pass
 * on hover the way the desktop journey does. Chromium's mobile emulation reports `hover: none`,
 * which is exactly what the screen keys its two-step tap flow off.
 */
const SEED = 20240617;
const URL = `/?seed=${SEED}&aiDelay=0`;

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

function ownCell(page: Page, at: Coord) {
  return page
    .getByRole('region', { name: 'Your waters' })
    .locator(`[data-coord="${coordLabel(at)}"]`);
}

function trayRow(page: Page, shipId: string) {
  return page.locator(`[data-ship-row="${shipId}"]`);
}

async function openPlacement(page: Page): Promise<void> {
  await page.goto(URL);
  await page.getByRole('button', { name: 'Start game' }).tap();
  const intro = page.getByRole('dialog', { name: 'Place your fleet' });
  await expect(intro).toContainText(
    'Tap a ship below, then tap the board to place it. Tap rotate to change direction.',
  );
  await intro.getByRole('button', { name: 'Got it' }).tap();
  await expect(intro).toBeHidden();
}

test('places a fleet by tapping, previewing every ship before it commits', async ({ page }) => {
  await openPlacement(page);

  const hud = page.getByTestId('board-hud-friendly');
  await expect(hud).toHaveText('Tap a ship below, then tap the board to place it.');

  // Picking a ship is a visible state, and the instruction moves on to the next step.
  await trayRow(page, 'battleship').tap();
  await expect(trayRow(page, 'battleship')).toHaveAttribute('data-selected', 'true');
  await expect(trayRow(page, 'carrier')).toHaveAttribute('data-selected', 'false');
  await expect(hud).toHaveText('Now tap the board to place it.');

  // The first tap only aims: the footprint is previewed and nothing is on the board yet.
  await ownCell(page, { r: 2, c: 1 }).tap();
  await expect(ownCell(page, { r: 2, c: 1 })).toHaveAttribute('data-state', 'valid placement');
  await expect(ownCell(page, { r: 2, c: 4 })).toHaveAttribute('data-state', 'valid placement');
  await expect(hud).toHaveText('Tap again to place your Battleship.');
  await expect(
    page.getByRole('region', { name: 'Your waters' }).locator('[data-ship="battleship"]'),
  ).toHaveCount(1);
  await expect(trayRow(page, 'battleship')).toHaveAttribute('data-placed', 'false');

  // Rotating re-aims the pending preview instead of committing it.
  await page.getByRole('button', { name: /^Rotate ship/ }).tap();
  await expect(ownCell(page, { r: 5, c: 1 })).toHaveAttribute('data-state', 'valid placement');
  await expect(ownCell(page, { r: 2, c: 4 })).toHaveAttribute('data-state', 'unknown');

  // The commit is spelled out, and only then does the ship land.
  const confirm = page.getByTestId('confirm-placement');
  await expect(confirm).toHaveText('Place Battleship at B3');
  await confirm.tap();
  await expect(trayRow(page, 'battleship')).toHaveAttribute('data-placed', 'true');
  await expect(confirm).toBeHidden();

  // An occupied square is refused by the engine, and the offer says so rather than misfiring.
  await expect(trayRow(page, 'carrier')).toHaveAttribute('data-selected', 'true');
  await ownCell(page, { r: 2, c: 1 }).tap();
  await expect(page.getByTestId('confirm-placement')).toBeDisabled();
  await expect(hud).toHaveText('That position is unavailable.');
  await expect(page.getByTestId('status-line')).toContainText('Overlaps Battleship');

  // Tapping elsewhere re-aims, and a second tap on that square places the ship.
  await ownCell(page, { r: 0, c: 5 }).tap();
  await ownCell(page, { r: 0, c: 5 }).tap();
  await expect(trayRow(page, 'carrier')).toHaveAttribute('data-placed', 'true');

  for (const shipId of ['cruiser', 'submarine', 'destroyer']) {
    await trayRow(page, shipId).tap();
    await page.getByRole('button', { name: /^Rotate ship/ }).tap();
    await ownCell(page, {
      r: 6,
      c: shipId === 'cruiser' ? 0 : shipId === 'submarine' ? 3 : 6,
    }).tap();
    await page.getByTestId('confirm-placement').tap();
    await expect(trayRow(page, shipId)).toHaveAttribute('data-placed', 'true');
  }

  await expect(hud).toHaveText('Fleet ready. Begin battle.');
  const begin = page.getByRole('button', { name: 'Begin battle' });
  await expect(begin).toBeEnabled();

  // Everything the flow needs stays a comfortable tap target, with no sideways scroll.
  for (const control of [begin, page.getByRole('button', { name: /^Rotate ship/ })]) {
    const box = await control.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  }
  const trayBox = await trayRow(page, 'carrier').boundingBox();
  expect(trayBox?.height ?? 0).toBeGreaterThanOrEqual(44);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);

  await begin.tap();
  await expect(page.getByRole('region', { name: 'Enemy waters' })).toBeVisible();
});

test('does not show the placement hint again in the same session', async ({ page }) => {
  await openPlacement(page);
  await page.getByRole('button', { name: 'Randomize fleet' }).tap();
  await page.getByRole('button', { name: 'Begin battle' }).tap();
  await page.getByRole('button', { name: 'Start attack' }).tap();

  await page.getByRole('button', { name: 'New game' }).tap();
  await page
    .getByRole('dialog', { name: 'Start a new game?' })
    .getByRole('button', { name: 'New game' })
    .tap();

  await expect(page.getByRole('heading', { name: 'Deploy your fleet' })).toBeVisible();
  await expect(page.getByRole('dialog')).toBeHidden();
});
