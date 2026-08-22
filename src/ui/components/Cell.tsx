import { coordLabel } from '../../engine/board.ts';
import type { Coord } from '../../engine/types.ts';

export type CellVariant =
  'water' | 'ship' | 'previewValid' | 'previewInvalid' | 'miss' | 'hit' | 'sunk';

/** Which state change, if any, this cell should animate on this render. */
export type CellAnimation = 'miss' | 'hit' | 'sunk' | null;

/*
 * Open water and the player's own ships add nothing: the ocean material and the ship drawn
 * underneath are what should be seen. Only resolved states paint the cell, and they stay
 * translucent enough for a hull to read through them.
 */
const VARIANT_CLASS: Readonly<Record<CellVariant, string>> = {
  water: 'text-transparent',
  ship: 'text-transparent',
  previewValid: 'bg-white/35 text-ink/70 ring-1 ring-inset ring-white/80',
  previewInvalid: 'bg-impact/15 text-impact ring-1 ring-inset ring-impact/45',
  miss: 'bg-white/45 text-ink-soft',
  hit: 'bg-impact/22 text-impact ring-1 ring-inset ring-impact/35',
  sunk: 'cell-hatched bg-paper-sunk/55 text-ink/70',
};

/**
 * Accessible state name. The vocabulary matches what the board shows, so the announcement of a
 * cell ("B4, hit") lines up with what a sighted player reads off the water.
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
      // Settled ripple: reads as water closing over nothing.
      return (
        <svg viewBox="0 0 24 24" aria-hidden className="h-1/2 w-1/2">
          <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <circle cx="12" cy="12" r="2.4" fill="currentColor" opacity="0.7" />
        </svg>
      );
    case 'hit':
      // Solid cross: reads as an impact.
      return (
        <svg viewBox="0 0 24 24" aria-hidden className="h-1/2 w-1/2">
          <path
            d="M6 6 L18 18 M18 6 L6 18"
            fill="none"
            stroke="currentColor"
            strokeWidth="3.6"
            strokeLinecap="round"
          />
        </svg>
      );
    case 'sunk':
      // Cross inside a frame, on hatching: an impact that finished a ship.
      return (
        <svg viewBox="0 0 24 24" aria-hidden className="h-2/3 w-2/3">
          <rect
            x="3.5"
            y="3.5"
            width="17"
            height="17"
            rx="3"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.2"
          />
          <path
            d="M8 8 L16 16 M16 8 L8 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.6"
            strokeLinecap="round"
          />
        </svg>
      );
    case 'previewInvalid':
      return (
        <svg viewBox="0 0 24 24" aria-hidden className="h-1/2 w-1/2">
          <path
            d="M5 19 L19 5"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
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
      /* `relative` gives the miss and hit animations their spray and ripple pseudo-elements. */
      className={`relative flex aspect-square items-center justify-center transition-colors duration-150 ${
        VARIANT_CLASS[variant]
      } ${animation ? ANIMATION_CLASS[animation] : ''} ${
        interactive ? 'cursor-pointer hover:bg-white/40' : 'cursor-default'
      }`}
    >
      <CellMark variant={variant} />
    </button>
  );
}
