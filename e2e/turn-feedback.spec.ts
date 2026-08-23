import { expect, test, type Page } from '@playwright/test';
import { allCoords, coordLabel, shipAt } from '../src/engine/board.ts';
import { createInitialState } from '../src/engine/reducer.ts';
import { shipSpec } from '../src/engine/rules.ts';
import type { Coord } from '../src/engine/types.ts';

/**
 * The two pieces of feedback that tell a player what just changed: the hull that went down, and
 * the turn that came back to them. `?idlePrompt=` shortens the idle-turn wait (see
 * `src/ui/urlOptions.ts`) so the nudge can be waited on rather than sat out, and `?aiDelay=` is
 * kept long here on purpose: the AI's turn has to still be running when it is asserted on.
 */
const SEED = 20240617;
const IDLE_PROMPT_MS = 600;
const AI_DELAY_MS = 8_000;
const URL = `/?seed=${SEED}&aiDelay=${AI_DELAY_MS}&idlePrompt=${IDLE_PROMPT_MS}`;

const aiBoard = createInitialState(SEED).boards.ai;
const shipCells = allCoords().filter((at) => shipAt(aiBoard, at) !== undefined);
const waterCells = allCoords().filter((at) => shipAt(aiBoard, at) === undefined);
const firstShip = shipAt(aiBoard, shipCells[0] as Coord);
if (firstShip === undefined) throw new Error('expected a ship on the seeded enemy board');

function enemyCell(page: Page, at: Coord) {
  return page
    .getByRole('region', { name: 'Enemy waters' })
    .locator(`[data-coord="${coordLabel(at)}"]`);
}

async function startBattle(page: Page): Promise<void> {
  await page.goto(URL);
  await page.getByRole('button', { name: 'Start game' }).click();
  await page.getByRole('dialog', { name: 'Place your fleet' }).getByRole('button').click();
  await page.getByRole('button', { name: 'Randomize fleet' }).click();
  await page.getByRole('button', { name: 'Begin battle' }).click();
  await page.getByRole('button', { name: 'Start attack' }).click();
  await expect(page.getByTestId('turn-banner')).toHaveText(/Your turn/);
}

test('names a hull only on the shot that sinks it, without pausing the game', async ({ page }) => {
  await startBattle(page);
  const notice = page.getByTestId('sunk-notice-human');

  for (const at of firstShip.cells.slice(0, -1)) {
    await enemyCell(page, at).click();
    // A plain hit is not a sinking: nothing is announced on the water.
    await expect(notice).toBeHidden();
  }

  await enemyCell(page, firstShip.cells.at(-1) as Coord).click();
  await expect(notice).toHaveText(`${shipSpec(firstShip.id).name.toUpperCase()} SUNK`);
  // Every cell of the hull is highlighted, not only the square that finished it.
  await expect(
    page.getByRole('region', { name: 'Enemy waters' }).locator('[data-state="sunk"]'),
  ).toHaveCount(firstShip.cells.length);

  // Nothing to dismiss, and nothing blocked: the next shot lands while the notice is still up.
  const next = waterCells[0] as Coord;
  await enemyCell(page, next).click();
  await expect(enemyCell(page, next)).toHaveAttribute('data-state', 'miss');
  await expect(notice).toBeHidden();
});

test('points out an idle turn, and only while the player holds it', async ({ page }) => {
  await startBattle(page);
  const prompt = page.getByTestId('idle-prompt');

  // A hit keeps the turn, which is exactly the moment a player can fail to notice.
  await enemyCell(page, firstShip.cells[0] as Coord).click();
  await page.mouse.move(0, 0);
  await expect(page.getByTestId('board-hud-enemy')).toHaveText('Your turn • Keep firing!');
  await expect(prompt).toHaveText("You're up! Make your next move.");

  // Touching the board is enough to put it away, and the board was never blocked by it.
  await enemyCell(page, waterCells[1] as Coord).hover();
  await expect(prompt).toBeHidden();

  // A miss hands the turn over: the AI's turn is never nudged.
  await enemyCell(page, waterCells[1] as Coord).click();
  await expect(page.getByTestId('turn-banner')).toContainText("AI's turn");
  await page.waitForTimeout(IDLE_PROMPT_MS * 3);
  await expect(prompt).toBeHidden();
});

test('stays quiet once the game is over', async ({ page }) => {
  await startBattle(page);
  for (const at of shipCells) {
    await enemyCell(page, at).click();
  }

  await expect(page.getByRole('dialog', { name: 'Game over' })).toBeVisible();
  await page.waitForTimeout(IDLE_PROMPT_MS * 3);
  await expect(page.getByTestId('idle-prompt')).toBeHidden();
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('shows both notices inside the water, without covering the grid', async ({ page }) => {
    await startBattle(page);

    for (const at of firstShip.cells) {
      await enemyCell(page, at).tap();
    }

    const notice = page.getByTestId('sunk-notice-human');
    await expect(notice).toHaveText(`${shipSpec(firstShip.id).name.toUpperCase()} SUNK`);
    const ocean = await page
      .getByRole('region', { name: 'Enemy waters' })
      .locator('.ocean')
      .boundingBox();
    const box = await notice.boundingBox();
    if (ocean === null || box === null) throw new Error('expected both to be laid out');
    expect(box.x).toBeGreaterThanOrEqual(ocean.x - 1);
    expect(box.x + box.width).toBeLessThanOrEqual(ocean.x + ocean.width + 1);
    expect(box.y + box.height).toBeLessThanOrEqual(ocean.y + ocean.height + 1);

    // The turn is still the player's, so the nudge arrives and a tap still fires through it.
    await expect(page.getByTestId('idle-prompt')).toBeVisible();
    const next = waterCells[0] as Coord;
    await enemyCell(page, next).tap();
    await expect(enemyCell(page, next)).toHaveAttribute('data-state', 'miss');
    await expect(page.getByTestId('idle-prompt')).toBeHidden();
  });
});
