import { coordLabel } from '../../engine/board.ts';
import type { Coord } from '../../engine/types.ts';

export type CellVariant =
  'water' | 'ship' | 'previewValid' | 'previewInvalid' | 'miss' | 'hit' | 'sunk';

const VARIANT_CLASS: Readonly<Record<CellVariant, string>> = {
  water: 'bg-slate-800 border-slate-700',
  ship: 'bg-slate-400 border-slate-300',
  previewValid: 'bg-emerald-500/70 border-emerald-300',
  previewInvalid: 'bg-rose-600/70 border-rose-300',
  miss: 'bg-slate-700 border-slate-600 text-slate-400',
  hit: 'bg-amber-500 border-amber-300 text-slate-900',
  sunk: 'bg-rose-700 border-rose-400 text-rose-100',
};

const VARIANT_TEXT: Readonly<Record<CellVariant, string>> = {
  water: 'water',
  ship: 'your ship',
  previewValid: 'valid placement',
  previewInvalid: 'invalid placement',
  miss: 'miss',
  hit: 'hit',
  sunk: 'sunk',
};

const VARIANT_MARK: Readonly<Partial<Record<CellVariant, string>>> = {
  miss: '·',
  hit: '✕',
  sunk: '✕',
};

export interface CellProps {
  readonly at: Coord;
  readonly variant: CellVariant;
  readonly disabled?: boolean;
  readonly onSelect?: (at: Coord) => void;
  readonly onHover?: (at: Coord | null) => void;
}

export function Cell({ at, variant, disabled = false, onSelect, onHover }: CellProps) {
  const interactive = !disabled && onSelect !== undefined;

  return (
    <button
      type="button"
      disabled={!interactive}
      aria-label={`${coordLabel(at)} ${VARIANT_TEXT[variant]}`}
      onClick={interactive ? () => onSelect(at) : undefined}
      onMouseEnter={onHover ? () => onHover(at) : undefined}
      onMouseLeave={onHover ? () => onHover(null) : undefined}
      onFocus={onHover ? () => onHover(at) : undefined}
      className={`flex aspect-square items-center justify-center rounded border text-xs leading-none transition-colors ${VARIANT_CLASS[variant]} ${
        interactive ? 'cursor-pointer hover:brightness-125' : 'cursor-default'
      } focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-sky-400`}
    >
      {VARIANT_MARK[variant] ?? ''}
    </button>
  );
}
