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

async function boxOf(
  locator: Locator,
): Promise<{ x: number; y: number; width: number; height: number }> {
  const box = await locator.boundingBox();
  if (box === null) throw new Error('expected the element to be laid out');
  return box;
}

/** The contextual line belongs inside the water, above the grid it explains. */
async function expectHudInsideBoard(page: Page, board: string, side: string): Promise<void> {
  const region = page.getByRole('region', { name: board });
  const hud = await boxOf(page.getByTestId(`board-hud-${side}`));
  const ocean = await boxOf(region.locator('.ocean'));
  const firstCell = await boxOf(region.locator('[data-coord="A1"]'));
  expect(hud.y).toBeGreaterThanOrEqual(ocean.y - 1);
  expect(hud.y + hud.height).toBeLessThanOrEqual(firstCell.y + 1);
}

/** An introduction belongs to the water it explains, and must stay within it. */
async function expectInsideBoard(page: Page, label: string, panel: Locator): Promise<void> {
  const ocean = await boxOf(page.getByRole('region', { name: label }).locator('.ocean'));
  const box = await boxOf(panel);
  expect(box.x).toBeGreaterThanOrEqual(ocean.x - 1);
  expect(box.y).toBeGreaterThanOrEqual(ocean.y - 1);
  expect(box.x + box.width).toBeLessThanOrEqual(ocean.x + ocean.width + 1);
  expect(box.y + box.height).toBeLessThanOrEqual(ocean.y + ocean.height + 1);
}

async function startBattle(page: Page): Promise<void> {
  await page.goto(URL);
  // The opening screen comes first; placement is one click away.
  await expect(page.getByText('Sink the enemy fleet before they sink yours.')).toBeVisible();
  // The objective and the turn rule are on the opening screen, before the detailed rules.
  await expect(page.getByRole('heading', { name: 'How to play' })).toBeVisible();
  await expect(page.getByText('Hit = fire again · Miss = turn changes')).toBeVisible();

  // The rules are a modal on the opening screen and must not start anything.
  await page.getByRole('button', { name: 'The rules' }).click();
  const rules = page.getByRole('dialog', { name: 'The rules' });
  await expect(rules.getByText('Ships may touch.')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(rules).toBeHidden();

  await page.getByRole('button', { name: 'Start game' }).click();

  await expect(page.getByRole('heading', { name: 'Deploy your fleet' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Begin battle' })).toBeDisabled();

  // Placement opens on its one-time invitation, drawn over the player's own water.
  const placementIntro = page.getByRole('dialog', { name: 'Place your fleet' });
  await expect(placementIntro).toBeVisible();
  await expectInsideBoard(page, 'Your waters', placementIntro);
  await expect(placementIntro).toContainText(
    'Tap a ship below, then tap the board to place it. Tap rotate to change direction.',
  );
  await expect(placementIntro.getByRole('button', { name: 'Got it' })).toBeFocused();
  await placementIntro.getByRole('button', { name: 'Got it' }).click();
  await expect(placementIntro).toBeHidden();

  // Away from the water, so the board asks for the first move rather than previewing one.
  await page.mouse.move(0, 0);
  await expect(page.getByTestId('board-hud-friendly')).toHaveText(
    'Tap a ship below, then tap the board to place it.',
  );
  await expectHudInsideBoard(page, 'Your waters', 'friendly');

  await page.getByRole('button', { name: 'Randomize fleet' }).click();
  await expect(page.getByRole('button', { name: 'Begin battle' })).toBeEnabled();
  await page.getByRole('button', { name: 'Begin battle' }).click();

  await expect(page.getByRole('region', { name: 'Enemy waters' })).toBeVisible();

  // And the battle opens on its own, over the water the player is about to fire at.
  const battleIntro = page.getByRole('dialog', { name: 'Choose your target' });
  await expect(battleIntro).toBeVisible();
  await expectInsideBoard(page, 'Enemy waters', battleIntro);
  await expect(battleIntro.getByRole('button', { name: 'Start attack' })).toBeFocused();
  // Enter activates it, as any button would.
  await page.keyboard.press('Enter');
  await expect(battleIntro).toBeHidden();

  await expect(page.getByTestId('turn-banner')).toHaveText(YOUR_TURN);
  await expect(page.getByTestId('board-hud-enemy')).toHaveText('Select where to attack.');
  await expectHudInsideBoard(page, 'Enemy waters', 'enemy');
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
  await enemyCell(page, firstHit).hover();
  await expect(page.getByTestId('board-hud-enemy')).toHaveText(`Fire at ${coordLabel(firstHit)}`);
  await enemyCell(page, firstHit).click();
  await expect(enemyCell(page, firstHit)).toHaveAttribute('data-state', /hit|sunk/);
  await expect(page.getByTestId('turn-banner')).toHaveText(YOUR_TURN);
  // Hit and miss must be readable apart at a glance: an impact mark against a splash.
  await expect(page.getByTestId('status-line')).toHaveText(/^(HIT|SUNK) · /);
  await expect(page.getByTestId('status-line')).toHaveAttribute('data-tone', 'impact');
  await expect(enemyCell(page, firstHit).locator('svg path')).toHaveCount(1);

  // A miss hands the turn to the AI, which then plays until it misses.
  const firstMiss = waterCells[0] as Coord;
  await enemyCell(page, firstMiss).click();
  await expect(enemyCell(page, firstMiss)).toHaveAttribute('data-state', 'miss');
  // Water keeps its plain ripple: no impact fragments, so the outcomes never look alike.
  await expect(enemyCell(page, firstMiss).locator('svg path')).toHaveCount(0);
  // The AI's shots land on the player's own water, and the contextual line reports the last one.
  await expect(
    page.getByRole('region', { name: 'Your waters' }).locator('[data-state="miss"]'),
  ).not.toHaveCount(0);
  await expect(page.getByTestId('status-line')).toContainText(/^AI /);
  await expect(page.getByTestId('turn-banner')).toHaveText(YOUR_TURN);

  // New game asks first, and cancelling leaves the game exactly as it was.
  const shotsBefore = await page
    .getByRole('region', { name: 'Enemy waters' })
    .locator('[data-state="hit"], [data-state="sunk"], [data-state="miss"]')
    .count();
  await page.getByRole('button', { name: 'New game' }).click();
  const confirm = page.getByRole('dialog', { name: 'Start a new game?' });
  await expect(confirm.getByText('Your current game will be lost.')).toBeVisible();
  await confirm.getByRole('button', { name: 'Cancel' }).click();
  await expect(confirm).toBeHidden();
  await expect(page.getByTestId('turn-banner')).toHaveText(YOUR_TURN);
  await expect(
    page
      .getByRole('region', { name: 'Enemy waters' })
      .locator('[data-state="hit"], [data-state="sunk"], [data-state="miss"]'),
  ).toHaveCount(shotsBefore);

  // Sink the rest of the fleet. Every shot is a hit, so the turn never leaves the player.
  for (const at of shipCells.slice(1)) {
    await enemyCell(page, at).click();
  }

  // The winning shot names the vessel it destroyed instead of reverting to an instruction.
  await expect(page.getByTestId('board-hud-enemy')).toHaveText(/ SUNK$/);

  const dialog = page.getByRole('dialog', { name: 'Game over' });
  await expect(dialog.getByRole('heading', { name: 'You win' })).toBeVisible();
  await expect(dialog.getByRole('row', { name: 'Ships sunk 5/5 0/5' })).toBeVisible();
  // The finished game is locked.
  await expect(enemyCell(page, waterCells[1] as Coord)).toHaveAttribute('aria-disabled', 'true');

  await dialog.getByRole('button', { name: 'Play again' }).click();
  await expect(page.getByRole('heading', { name: 'Deploy your fleet' })).toBeVisible();
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Begin battle' })).toBeDisabled();
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

/**
 * Guards the palette: the muted greys used for captions, coordinates and micro-copy are the
 * easiest thing to make too pale, so every piece of visible text is measured against the surface
 * it actually sits on (glass included) rather than trusted by eye.
 */
test('every visible text meets WCAG AA contrast', async ({ page }) => {
  const measure = () =>
    page.evaluate(() => {
      const canvas = document.createElement('canvas');
      canvas.width = 1;
      canvas.height = 1;
      const ctx = canvas.getContext('2d');
      if (ctx === null) throw new Error('no 2d context');
      // Colours are authored in oklch; a canvas resolves any CSS colour to real RGBA.
      const resolve = (value: string): { rgb: number[]; alpha: number } => {
        ctx.clearRect(0, 0, 1, 1);
        ctx.fillStyle = value;
        ctx.fillRect(0, 0, 1, 1);
        const [r = 0, g = 0, b = 0, a = 0] = ctx.getImageData(0, 0, 1, 1).data;
        return { rgb: [r, g, b], alpha: a / 255 };
      };
      const luminance = ([r = 0, g = 0, b = 0]: number[]): number => {
        const channel = (c: number): number => {
          const v = c / 255;
          return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
        };
        return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
      };
      const flatten = (top: number[], alpha: number, bottom: number[]): number[] =>
        top.map((c, index) => c * alpha + (bottom[index] ?? 255) * (1 - alpha));
      const surfaceUnder = (el: Element): number[] => {
        const layers: { rgb: number[]; alpha: number }[] = [];
        for (let node: Element | null = el; node !== null; node = node.parentElement) {
          const layer = resolve(getComputedStyle(node).backgroundColor);
          if (layer.alpha > 0) layers.push(layer);
          if (layer.alpha === 1) break;
        }
        return layers.reduceRight<number[]>(
          (below, layer) => flatten(layer.rgb, layer.alpha, below),
          [255, 255, 255],
        );
      };

      return [...document.querySelectorAll('body *')]
        .filter((el) => {
          const style = getComputedStyle(el);
          return (
            [...el.childNodes].some(
              (n) => n.nodeType === 3 && (n.textContent ?? '').trim() !== '',
            ) &&
            el.getBoundingClientRect().height > 0 &&
            style.visibility !== 'hidden' &&
            style.opacity !== '0' &&
            el.closest('.sr-only') === null &&
            // WCAG 1.4.3 exempts inactive controls.
            el.closest('[disabled], [aria-disabled="true"]') === null
          );
        })
        .map((el) => {
          const style = getComputedStyle(el);
          const surface = surfaceUnder(el);
          const { rgb, alpha } = resolve(style.color);
          const text = luminance(flatten(rgb, alpha, surface));
          const background = luminance(surface);
          const ratio = (Math.max(text, background) + 0.05) / (Math.min(text, background) + 0.05);
          const size = parseFloat(style.fontSize);
          const large = size >= 24 || (size >= 18.66 && Number(style.fontWeight) >= 700);
          return {
            text: (el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 24),
            ratio: Number(ratio.toFixed(2)),
            required: large ? 3 : 4.5,
          };
        })
        .filter((sample) => sample.ratio < sample.required);
    });

  await page.goto(URL);
  expect(await measure(), 'opening screen').toEqual([]);
  await page.getByRole('button', { name: 'The rules' }).click();
  await expect(page.getByRole('dialog', { name: 'The rules' })).toBeVisible();
  expect(await measure(), 'rules modal').toEqual([]);
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: 'Start game' }).click();
  await expect(page.getByRole('heading', { name: 'Deploy your fleet' })).toBeVisible();
  // The stage introductions are measured too, then dismissed.
  expect(await measure(), 'placement intro').toEqual([]);
  await page.getByRole('button', { name: 'Got it' }).click();
  expect(await measure(), 'placement').toEqual([]);

  await page.getByRole('button', { name: 'Randomize fleet' }).click();
  await page.getByRole('button', { name: 'Begin battle' }).click();
  expect(await measure(), 'battle intro').toEqual([]);
  await page.getByRole('button', { name: 'Start attack' }).click();
  await expect(page.getByTestId('turn-banner')).toHaveText(YOUR_TURN);
  expect(await measure(), 'battle').toEqual([]);

  for (const at of shipCells) {
    await enemyCell(page, at).click();
  }
  await expect(page.getByRole('dialog', { name: 'Game over' })).toBeVisible();
  expect(await measure(), 'game over').toEqual([]);
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
