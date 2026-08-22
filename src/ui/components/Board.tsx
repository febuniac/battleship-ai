import { useEffect, useRef, useState } from 'react';
import { allCoords, coordLabel } from '../../engine/board.ts';
import { BOARD_SIZE } from '../../engine/rules.ts';
import type { Coord } from '../../engine/types.ts';
import { Cell, type CellAnimation, type CellVariant } from './Cell.tsx';
import { ShipLayer, type ShipVisual } from './ShipLayer.tsx';

const COLUMN_LABELS = Array.from({ length: BOARD_SIZE }, (_unused, index) =>
  String.fromCharCode(65 + index),
);

const ROWS = Array.from({ length: BOARD_SIZE }, (_unused, row) => row);

const CELLS = allCoords();

function clamp(value: number): number {
  return Math.max(0, Math.min(BOARD_SIZE - 1, value));
}

/** Arrow / Home / End movement within the grid; anything else is left to the browser. */
function moveFocus(from: Coord, key: string): Coord | null {
  switch (key) {
    case 'ArrowUp':
      return { r: clamp(from.r - 1), c: from.c };
    case 'ArrowDown':
      return { r: clamp(from.r + 1), c: from.c };
    case 'ArrowLeft':
      return { r: from.r, c: clamp(from.c - 1) };
    case 'ArrowRight':
      return { r: from.r, c: clamp(from.c + 1) };
    case 'Home':
      return { r: from.r, c: 0 };
    case 'End':
      return { r: from.r, c: BOARD_SIZE - 1 };
    default:
      return null;
  }
}

/**
 * The two waters are the same material, separated only by temperature: the enemy's is cooler and
 * deeper, the player's own is calmer and lighter. No frames, no cards — the board is the object.
 */
const SIDE_CLASS = {
  enemy: 'ring-1 ring-inset ring-ink/10',
  friendly: 'ring-1 ring-inset ring-white/70 saturate-[0.82] brightness-[1.03]',
} as const;

export interface BoardProps {
  readonly label: string;
  readonly caption?: string;
  /** A quiet line under the board's title telling a first-time player what to do here. */
  readonly hint?: string;
  /** Holds the hint line's space open so a hintless board's grid stays level with its sibling. */
  readonly hintSpacer?: boolean;
  readonly side: keyof typeof SIDE_CLASS;
  /** Which water the player should be looking at: the one they can act on, or the one they wait on. */
  readonly emphasis?: 'active' | 'idle';
  readonly variantAt: (at: Coord) => CellVariant;
  readonly animationAt?: (at: Coord) => CellAnimation;
  /**
   * Ship silhouettes to draw across their cells. Afloat vessels sit behind the cell buttons;
   * wrecks are drawn on top so a sunk ship reads as one hull across its hit markers.
   */
  readonly ships?: readonly ShipVisual[];
  readonly onSelect?: (at: Coord) => void;
  readonly onHover?: (at: Coord | null) => void;
  readonly cellDisabled?: (at: Coord) => boolean;
  readonly disabled?: boolean;
  /**
   * Changing this value moves keyboard focus into the grid. Used at the moments where focus
   * would otherwise be lost (entering the battle, returning from the game-over dialog).
   */
  readonly focusKey?: number;
}

/**
 * A 10x10 grid of cells with a single tab stop (roving `tabindex`), so reaching the board and
 * moving around inside it are separate steps for keyboard users instead of 100 tab presses.
 *
 * Coordinate labels sit outside the water, which lets the ship layer share the exact grid
 * geometry of the cells.
 */
export function Board({
  label,
  caption,
  hint,
  hintSpacer = false,
  side,
  emphasis,
  variantAt,
  animationAt,
  ships,
  onSelect,
  onHover,
  cellDisabled,
  disabled = false,
  focusKey,
}: BoardProps) {
  const afloat = (ships ?? []).filter((ship) => ship.tone !== 'wreck');
  const wrecks = (ships ?? []).filter((ship) => ship.tone === 'wreck');
  const gridRef = useRef<HTMLDivElement>(null);
  const [cursor, setCursor] = useState<Coord>({ r: 0, c: 0 });

  const focusCell = (at: Coord) => {
    gridRef.current
      ?.querySelector<HTMLButtonElement>(`[data-coord="${coordLabel(at)}"]`)
      ?.focus({ preventScroll: true });
  };

  useEffect(() => {
    if (focusKey === undefined) return;
    gridRef.current?.querySelector<HTMLButtonElement>('[tabindex="0"]')?.focus();
  }, [focusKey]);

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const next = moveFocus(cursor, event.key);
    if (!next) return;
    event.preventDefault();
    setCursor(next);
    focusCell(next);
  };

  return (
    <section aria-label={label} className="flex flex-col gap-2.5">
      <header className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 px-0.5">
        <h2 className="text-[0.7rem] font-medium tracking-[0.18em] text-ink-soft uppercase">
          {label}
        </h2>
        {caption ? <p className="text-xs text-ink-faint">{caption}</p> : null}
      </header>

      {hint !== undefined || hintSpacer ? (
        <p aria-hidden={hint === undefined} className="-mt-1 px-0.5 text-xs text-ink-faint">
          {hint ?? '\u00a0'}
        </p>
      ) : null}

      <div className="grid grid-cols-[0.9rem_minmax(0,1fr)] items-center gap-x-1.5 sm:gap-x-2">
        <div aria-hidden />
        <div
          aria-hidden
          className="grid grid-cols-10 pb-1.5 text-center text-[0.6rem] font-medium tracking-[0.1em] text-ink-faint"
        >
          {COLUMN_LABELS.map((column) => (
            <div key={column}>{column}</div>
          ))}
        </div>

        <div
          aria-hidden
          className="grid grid-rows-10 self-stretch pr-0.5 text-[0.6rem] font-medium text-ink-faint tabular-nums"
        >
          {ROWS.map((row) => (
            <div key={row} className="flex items-center justify-end">
              {row + 1}
            </div>
          ))}
        </div>

        {/*
         * Plain grid of buttons rather than ARIA `grid` semantics: each cell already announces
         * its coordinate and state, and native buttons keep Enter/Space working everywhere.
         * The hairline grid is painted by the water itself, so the cells add no borders of their
         * own and a hull can span them without interruption.
         */}
        <div
          ref={gridRef}
          onKeyDown={onKeyDown}
          data-emphasis={emphasis}
          className={`ocean ocean-grid relative overflow-hidden rounded-xl sm:rounded-2xl ${
            SIDE_CLASS[side]
          } ${emphasis === undefined ? '' : `ocean-${emphasis}`}`}
        >
          <ShipLayer ships={afloat} />
          <div className="relative grid grid-cols-10">
            {CELLS.map((at) => (
              <Cell
                key={coordLabel(at)}
                at={at}
                variant={variantAt(at)}
                animation={animationAt?.(at) ?? null}
                disabled={disabled || cellDisabled?.(at) === true}
                tabIndex={at.r === cursor.r && at.c === cursor.c ? 0 : -1}
                onFocusCell={setCursor}
                {...(onSelect ? { onSelect } : {})}
                {...(onHover ? { onHover } : {})}
              />
            ))}
          </div>
          <ShipLayer ships={wrecks} />
        </div>
      </div>
    </section>
  );
}
