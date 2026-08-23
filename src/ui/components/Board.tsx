import { useEffect, useRef, useState } from 'react';
import { allCoords, coordLabel } from '../../engine/board.ts';
import { BOARD_SIZE } from '../../engine/rules.ts';
import type { Coord } from '../../engine/types.ts';
import { Cell, type CellAnimation, type CellVariant } from './Cell.tsx';

const COLUMN_LABELS = Array.from({ length: BOARD_SIZE }, (_unused, index) =>
  String.fromCharCode(65 + index),
);

const ROWS = Array.from({ length: BOARD_SIZE }, (_unused, row) => row);

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

export interface BoardProps {
  readonly label: string;
  readonly caption?: string;
  readonly variantAt: (at: Coord) => CellVariant;
  readonly animationAt?: (at: Coord) => CellAnimation;
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
 */
export function Board({
  label,
  caption,
  variantAt,
  animationAt,
  onSelect,
  onHover,
  cellDisabled,
  disabled = false,
  focusKey,
}: BoardProps) {
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

      {/*
       * Plain grid of buttons rather than ARIA `grid` semantics: each cell already announces
       * its coordinate and state, and native buttons keep Enter/Space working everywhere.
       */}
      <div
        ref={gridRef}
        onKeyDown={onKeyDown}
        className="grid grid-cols-[1.1rem_repeat(10,minmax(0,1fr))] gap-px rounded-md border border-sea-700 bg-sea-900/70 p-1 sm:gap-0.5 sm:p-1.5"
      >
        <div aria-hidden />
        {COLUMN_LABELS.map((column) => (
          <div
            key={column}
            aria-hidden
            className="pb-0.5 text-center text-[0.6rem] font-medium text-slate-500"
          >
            {column}
          </div>
        ))}

        {ROWS.map((row) => (
          <Row
            key={row}
            row={row}
            cursor={cursor}
            variantAt={variantAt}
            {...(animationAt ? { animationAt } : {})}
            {...(onSelect ? { onSelect } : {})}
            {...(onHover ? { onHover } : {})}
            {...(cellDisabled ? { cellDisabled } : {})}
            disabled={disabled}
            onFocusCell={setCursor}
          />
        ))}
      </div>
    </section>
  );
}

interface RowProps extends Omit<BoardProps, 'label' | 'caption' | 'focusKey'> {
  readonly row: number;
  readonly cursor: Coord;
  readonly onFocusCell: (at: Coord) => void;
}

function Row({
  row,
  cursor,
  variantAt,
  animationAt,
  onSelect,
  onHover,
  cellDisabled,
  disabled,
  onFocusCell,
}: RowProps) {
  const cells = allCoords().filter((coord) => coord.r === row);

  return (
    <>
      <div
        aria-hidden
        className="flex items-center justify-end pr-1 text-[0.6rem] font-medium text-slate-500"
      >
        {row + 1}
      </div>
      {cells.map((at) => (
        <Cell
          key={coordLabel(at)}
          at={at}
          variant={variantAt(at)}
          animation={animationAt?.(at) ?? null}
          disabled={disabled === true || cellDisabled?.(at) === true}
          tabIndex={at.r === cursor.r && at.c === cursor.c ? 0 : -1}
          onFocusCell={onFocusCell}
          {...(onSelect ? { onSelect } : {})}
          {...(onHover ? { onHover } : {})}
        />
      ))}
    </>
  );
}
