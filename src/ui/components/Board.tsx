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

/** The two boards are framed differently so the target and the home fleet never get confused. */
const SIDE_CLASS = {
  enemy: 'border-sky-400/25 shadow-[0_0_0_1px_rgba(56,189,248,0.06)]',
  friendly: 'border-emerald-400/20 shadow-[0_0_0_1px_rgba(52,211,153,0.06)]',
} as const;

export interface BoardProps {
  readonly label: string;
  readonly caption?: string;
  readonly side: keyof typeof SIDE_CLASS;
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
 * Coordinate gutters sit outside the playing surface, which lets the ship layer share the exact
 * grid geometry of the cells.
 */
export function Board({
  label,
  caption,
  side,
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
    <section aria-label={label} className="flex flex-col gap-2">
      <header className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <h2 className="text-sm font-semibold tracking-[0.08em] text-slate-100 uppercase">
          {label}
        </h2>
        {caption ? <p className="text-xs text-slate-400">{caption}</p> : null}
      </header>

      <div className={`rounded-lg border bg-sea-900/60 p-2 sm:p-2.5 ${SIDE_CLASS[side]}`}>
        <div className="grid grid-cols-[1.1rem_minmax(0,1fr)] gap-x-1">
          <div aria-hidden />
          <div
            aria-hidden
            className="grid grid-cols-10 gap-px pb-1 text-center text-[0.6rem] font-medium tracking-wider text-slate-400 sm:gap-0.5"
          >
            {COLUMN_LABELS.map((column) => (
              <div key={column}>{column}</div>
            ))}
          </div>

          <div
            aria-hidden
            className="grid grid-rows-10 gap-px pr-1 text-[0.6rem] font-medium tabular-nums text-slate-400 sm:gap-0.5"
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
           * The ship layer is decorative and sits underneath, showing through the cell gaps and
           * the translucent ship / preview cells so a fleet reads as one object.
           */}
          <div
            ref={gridRef}
            onKeyDown={onKeyDown}
            className="ocean-surface relative rounded-sm ring-1 ring-inset ring-white/5"
          >
            <ShipLayer ships={afloat} />
            <div className="relative grid grid-cols-10 gap-px sm:gap-0.5">
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
      </div>
    </section>
  );
}
