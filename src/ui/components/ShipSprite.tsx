import { shipSpec } from '../../engine/rules.ts';
import type { Orientation, ShipId } from '../../engine/types.ts';

/** SVG units per board cell. Every silhouette is drawn `size * UNIT` long and `UNIT` tall. */
const UNIT = 20;

/**
 * How a ship is being shown: an intact ship of the player's fleet, a placement ghost, a
 * rejected placement, or a wreck once the engine reports the ship as sunk. The palette for each
 * tone lives in `index.css` as custom properties, so the geometry below is tone-agnostic.
 */
export type ShipTone = 'fleet' | 'ghost' | 'invalid' | 'wreck';

const TONE_CLASS: Readonly<Record<ShipTone, string>> = {
  fleet: 'ship-tone-fleet',
  ghost: 'ship-tone-ghost',
  invalid: 'ship-tone-invalid',
  wreck: 'ship-tone-wreck',
};

/**
 * Surface-ship hull seen from above: squared stern to port, tapered bow to starboard. `top` and
 * `bottom` set how much of the cell the hull fills, which is what separates a bulky carrier from
 * a lean destroyer at a glance; `rake` sets how sharp the bow is.
 */
function hull(length: number, top: number, bottom: number, rake: number): string {
  const bow = length - 2;
  const shoulder = bow - rake;
  return [
    `M 2.6 ${top}`,
    `L ${shoulder} ${top}`,
    `Q ${bow} 10 ${shoulder} ${bottom}`,
    `L 2.6 ${bottom}`,
    `Q 1.4 10 2.6 ${top}`,
    'Z',
  ].join(' ');
}

function Hull({ d }: { readonly d: string }) {
  return <path d={d} className="ship-hull" fill="var(--ship-hull)" stroke="var(--ship-line)" />;
}

/** Lighter deck inset inside the hull, which is what gives the flat top-down shape its volume. */
function Deck({
  from,
  to,
  top,
  bottom,
}: {
  readonly from: number;
  readonly to: number;
  readonly top: number;
  readonly bottom: number;
}) {
  return (
    <rect
      x={from}
      y={top}
      width={to - from}
      height={bottom - top}
      rx={(bottom - top) / 2}
      fill="var(--ship-deck)"
      className="ship-deck"
    />
  );
}

/** Main gun turret: barbette plus barrels trained towards the bow. */
function Turret({ x, radius = 2.4 }: { readonly x: number; readonly radius?: number }) {
  return (
    <g className="ship-detail">
      <circle cx={x} cy="10" r={radius} fill="var(--ship-detail)" />
      <path
        d={`M ${x} ${10 - radius * 0.4} H ${x + radius * 2.4} M ${x} ${10 + radius * 0.4} H ${x + radius * 2.4}`}
        stroke="var(--ship-detail)"
        strokeWidth="0.9"
        strokeLinecap="round"
      />
    </g>
  );
}

/** Bridge tower, funnel or conning tower: a dark block amidships. */
function Block({
  x,
  width,
  height,
}: {
  readonly x: number;
  readonly width: number;
  readonly height: number;
}) {
  return (
    <rect
      x={x}
      y={10 - height / 2}
      width={width}
      height={height}
      rx="0.8"
      fill="var(--ship-detail)"
      className="ship-detail"
    />
  );
}

/** Carrier: the widest hull, a full-length flight deck and a starboard island. */
function Carrier(length: number) {
  const bow = length - 2;
  const deck = `M 2.2 3 L ${bow - 9} 3 L ${bow} 8 L ${bow} 12 L ${bow - 9} 17 L 2.2 17 Q 0.9 10 2.2 3 Z`;
  return (
    <>
      <Hull d={deck} />
      {/* Angled landing strip aft, straight take-off strip forward: the flat-top read. */}
      <path
        d={`M 4 14.4 L ${length * 0.42} 6.4`}
        stroke="var(--ship-deck)"
        strokeWidth="0.8"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d={`M ${length * 0.3} 10.4 H ${bow - 11}`}
        stroke="var(--ship-deck)"
        strokeWidth="0.8"
        strokeDasharray="4 4"
        fill="none"
      />
      <rect
        x={length * 0.58}
        y="12.6"
        width={length * 0.16}
        height="4.2"
        rx="0.8"
        fill="var(--ship-detail)"
        className="ship-detail"
      />
      <path
        d={`M ${length * 0.72} 12.6 V 17`}
        stroke="var(--ship-detail)"
        strokeWidth="0.8"
        fill="none"
      />
    </>
  );
}

/** Battleship: deep armoured hull, two main turrets and a tall bridge amidships. */
function Battleship(length: number) {
  return (
    <>
      <Hull d={hull(length, 4.6, 15.4, 11)} />
      <Deck from={4} to={length - 11} top={6.4} bottom={13.6} />
      <Turret x={length * 0.16} radius={2.3} />
      <Turret x={length * 0.66} radius={2.3} />
      <Block x={length * 0.36} width={length * 0.12} height={8} />
      <Block x={length * 0.52} width={length * 0.07} height={6} />
    </>
  );
}

/** Cruiser: leaner hull, a single forward turret and one funnel. */
function Cruiser(length: number) {
  return (
    <>
      <Hull d={hull(length, 6, 14, 10)} />
      <Deck from={4} to={length - 10} top={7.6} bottom={12.4} />
      <Turret x={length * 0.62} radius={1.9} />
      <Block x={length * 0.3} width={length * 0.11} height={6.4} />
      <Block x={length * 0.45} width={length * 0.06} height={4.6} />
    </>
  );
}

/** Submarine: a rounded pressure hull with a conning tower — blunt at both ends, unlike the rest. */
function Submarine(length: number) {
  const body = `M 6.5 6.8 Q 1.8 10 6.5 13.2 L ${length - 6} 13.2 Q ${length - 1.4} 10 ${length - 6} 6.8 Z`;
  return (
    <>
      <Hull d={body} />
      <path
        d={`M 7 10 H ${length - 7}`}
        stroke="var(--ship-deck)"
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
      />
      {/* Conning tower amidships, plus the dive planes that make the shape read as a submarine. */}
      <rect
        x={length * 0.36}
        y="7.2"
        width={length * 0.14}
        height="5.6"
        rx="1.4"
        fill="var(--ship-detail)"
        className="ship-detail"
      />
      <path
        d={`M ${length * 0.16} 7.6 V 12.4`}
        stroke="var(--ship-detail)"
        strokeWidth="1.4"
        strokeLinecap="round"
        fill="none"
      />
    </>
  );
}

/** Destroyer: the shortest hull, sharply raked, with one gun and a single funnel. */
function Destroyer(length: number) {
  return (
    <>
      <Hull d={hull(length, 6.6, 13.4, 9)} />
      <Deck from={3.6} to={length - 9} top={8.2} bottom={11.8} />
      <Turret x={length * 0.6} radius={1.7} />
      <Block x={length * 0.28} width={length * 0.12} height={5.4} />
    </>
  );
}

const BODY: Readonly<Record<ShipId, (length: number) => React.ReactNode>> = {
  carrier: Carrier,
  battleship: Battleship,
  cruiser: Cruiser,
  submarine: Submarine,
  destroyer: Destroyer,
};

export interface ShipSpriteProps {
  readonly shipId: ShipId;
  readonly orientation?: Orientation;
  readonly tone?: ShipTone;
  readonly className?: string;
  readonly style?: React.CSSProperties;
}

/**
 * Decorative silhouette of a single ship, `size` cells long. Vertical ships reuse the horizontal
 * drawing under a quarter-turn transform, so rotating during placement rotates the actual vessel.
 */
export function ShipSprite({
  shipId,
  orientation = 'horizontal',
  tone = 'fleet',
  className = '',
  style,
}: ShipSpriteProps) {
  const length = shipSpec(shipId).size * UNIT;
  const vertical = orientation === 'vertical';

  return (
    <svg
      viewBox={vertical ? `0 0 ${UNIT} ${length}` : `0 0 ${length} ${UNIT}`}
      aria-hidden
      focusable="false"
      data-ship={shipId}
      style={style}
      className={`ship-sprite ${TONE_CLASS[tone]} ${className}`}
    >
      <g transform={vertical ? `translate(${UNIT} 0) rotate(90)` : undefined}>
        {BODY[shipId](length)}
      </g>
    </svg>
  );
}
