import { coordLabel } from '../../engine/board.ts';
import type { Coord } from '../../engine/types.ts';

export type CellVariant =
  'water' | 'ship' | 'previewValid' | 'previewInvalid' | 'miss' | 'hit' | 'sunk';

/** Which state change, if any, this cell should animate on this render. */
export type CellAnimation = 'miss' | 'hit' | 'sunk' | null;

/*
 * Cells that sit over a ship silhouette are deliberately translucent so the drawing below stays
 * readable; resolved states (miss / hit / sunk) stay opaque enough to dominate it.
 */
const VARIANT_CLASS: Readonly<Record<CellVariant, string>> = {
  water: 'bg-sea-800/55 border-sea-700/50 text-sea-600',
  // Nothing of its own: the ship drawn underneath is what the player should see.
  ship: 'border-transparent text-slate-700',
  previewValid: 'bg-emerald-400/12 border-emerald-300/50 text-emerald-100',
  previewInvalid: 'bg-rose-500/18 border-rose-300/60 text-rose-50',
  miss: 'bg-sea-700/85 border-sea-600 text-slate-200',
  hit: 'cell-plating bg-amber-400/70 border-amber-200 text-amber-950',
  // Translucent so the wreck drawn underneath stays visible through the hatching.
  sunk: 'cell-hatched bg-rose-800/45 border-rose-400 text-rose-50',
};

/**
 * Accessible state name. The vocabulary matches what the legend shows, so the announcement of
 * a cell ("B4, hit") lines up with what a sighted player reads off the board.
 */
const VARIANT_TEXT: Readonly<Record<CellVariant, string>> = {
  water: 'unknown',
  ship: 'your ship',
  previewValid: 'valid placement',
  previewInvalid: 'invalid placement',
  miss: 'miss',
  hit: 'hit',
  sunk: 'sunk',
};

const ANIMATION_CLASS: Readonly<Record<Exclude<CellAnimation, null>, string>> = {
  miss: 'animate-shot-miss',
  hit: 'animate-shot-hit',
  sunk: 'animate-shot-sunk',
};

/**
 * Every resolved state carries a distinct shape as well as a distinct colour, so miss / hit /
 * sunk stay separable without colour vision (and in greyscale screenshots).
 */
function CellMark({ variant }: { readonly variant: CellVariant }) {
  switch (variant) {
    case 'miss':
      // Hollow ring: reads as "nothing here".
      return (
        <svg viewBox="0 0 24 24" aria-hidden className="h-1/3 w-1/3">
          <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="4" />
        </svg>
      );
    case 'hit':
      // Solid cross: reads as an impact.
      return (
        <svg viewBox="0 0 24 24" aria-hidden className="h-2/3 w-2/3">
          <path
            d="M6 6 L18 18 M18 6 L6 18"
            fill="none"
            stroke="currentColor"
            strokeWidth="4.5"
            strokeLinecap="round"
          />
        </svg>
      );
    case 'sunk':
      // Cross inside a frame, on hatching: an impact that finished a ship.
      return (
        <svg viewBox="0 0 24 24" aria-hidden className="h-3/4 w-3/4">
          <rect x="3" y="3" width="18" height="18" rx="3" fill="none" stroke="currentColor" />
          <path
            d="M7 7 L17 17 M17 7 L7 17"
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
            strokeLinecap="round"
          />
        </svg>
      );
    case 'previewInvalid':
      return (
        <svg viewBox="0 0 24 24" aria-hidden className="h-2/3 w-2/3">
          <path
            d="M5 19 L19 5"
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
            strokeLinecap="round"
          />
        </svg>
      );
    default:
      return null;
  }
}

export interface CellProps {
  readonly at: Coord;
  readonly variant: CellVariant;
  /** Marked `aria-disabled` rather than `disabled`: unavailable cells stay readable and reachable. */
  readonly disabled?: boolean;
  readonly tabIndex?: number;
  readonly animation?: CellAnimation;
  readonly onSelect?: (at: Coord) => void;
  readonly onHover?: (at: Coord | null) => void;
  readonly onFocusCell?: (at: Coord) => void;
}

export function Cell({
  at,
  variant,
  disabled = false,
  tabIndex = -1,
  animation = null,
  onSelect,
  onHover,
  onFocusCell,
}: CellProps) {
  const interactive = !disabled && onSelect !== undefined;

  return (
    <button
      type="button"
      data-coord={coordLabel(at)}
      data-state={VARIANT_TEXT[variant]}
      aria-disabled={onSelect === undefined || disabled ? true : undefined}
      aria-label={`${coordLabel(at)}, ${VARIANT_TEXT[variant]}`}
      tabIndex={tabIndex}
      onClick={interactive ? () => onSelect(at) : undefined}
      onMouseEnter={onHover ? () => onHover(at) : undefined}
      onMouseLeave={onHover ? () => onHover(null) : undefined}
      onFocus={() => {
        onFocusCell?.(at);
        onHover?.(at);
      }}
      className={`flex aspect-square items-center justify-center rounded-[0.2rem] border transition-[filter,background-color] duration-150 ${
        VARIANT_CLASS[variant]
      } ${animation ? ANIMATION_CLASS[animation] : ''} ${
        interactive
          ? 'cursor-pointer hover:brightness-125 hover:ring-1 hover:ring-sky-300/70 hover:ring-inset'
          : 'cursor-default'
      }`}
    >
      <CellMark variant={variant} />
    </button>
  );
}
