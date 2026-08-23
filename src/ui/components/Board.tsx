import { allCoords } from '../../engine/board.ts';
import { BOARD_SIZE } from '../../engine/rules.ts';
import type { Coord } from '../../engine/types.ts';
import { Cell, type CellVariant } from './Cell.tsx';

const COLUMN_LABELS = Array.from({ length: BOARD_SIZE }, (_unused, index) =>
  String.fromCharCode(65 + index),
);

export interface BoardProps {
  readonly label: string;
  readonly caption?: string;
  readonly variantAt: (at: Coord) => CellVariant;
  readonly onSelect?: (at: Coord) => void;
  readonly onHover?: (at: Coord | null) => void;
  readonly cellDisabled?: (at: Coord) => boolean;
  readonly disabled?: boolean;
}

export function Board({
  label,
  caption,
  variantAt,
  onSelect,
  onHover,
  cellDisabled,
  disabled = false,
}: BoardProps) {
  return (
    <section aria-label={label} className="flex flex-col gap-2">
      <header className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold tracking-wide text-slate-100 uppercase">{label}</h2>
        {caption ? <p className="text-xs text-slate-400">{caption}</p> : null}
      </header>

      <div className="grid grid-cols-[1.25rem_repeat(10,minmax(0,1fr))] gap-0.5 sm:gap-1">
        <div aria-hidden />
        {COLUMN_LABELS.map((column) => (
          <div key={column} aria-hidden className="text-center text-[0.6rem] text-slate-500">
            {column}
          </div>
        ))}

        {Array.from({ length: BOARD_SIZE }, (_unused, row) => (
          <Row
            key={row}
            row={row}
            variantAt={variantAt}
            {...(onSelect ? { onSelect } : {})}
            {...(onHover ? { onHover } : {})}
            {...(cellDisabled ? { cellDisabled } : {})}
            disabled={disabled}
          />
        ))}
      </div>
    </section>
  );
}

interface RowProps extends Omit<BoardProps, 'label' | 'caption'> {
  readonly row: number;
}

function Row({ row, variantAt, onSelect, onHover, cellDisabled, disabled }: RowProps) {
  const cells = allCoords().filter((coord) => coord.r === row);

  return (
    <>
      <div aria-hidden className="flex items-center justify-end pr-1 text-[0.6rem] text-slate-500">
        {row + 1}
      </div>
      {cells.map((at) => (
        <Cell
          key={`${at.r},${at.c}`}
          at={at}
          variant={variantAt(at)}
          disabled={disabled === true || cellDisabled?.(at) === true}
          {...(onSelect ? { onSelect } : {})}
          {...(onHover ? { onHover } : {})}
        />
      ))}
    </>
  );
}
