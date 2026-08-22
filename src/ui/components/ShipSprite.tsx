import { useId } from 'react';
import { shipSpec } from '../../engine/rules.ts';
import type { Orientation, ShipId } from '../../engine/types.ts';

/** SVG units per board cell. Every silhouette is drawn `size * UNIT` long and `UNIT` tall. */
const UNIT = 20;

/** Centreline of every drawing: hulls are symmetrical about it. */
const AXIS = UNIT / 2;

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

/** Painted parts share one brushed-steel gradient per sprite instance. */
interface Paint {
  readonly hull: string;
  readonly deck: string;
}

/**
 * Plan view of a surface hull: a rounded transom at the stern (left), parallel mid-body, and a
 * fine raked bow (right). `beam` is the half-width, which is what separates a bulky carrier from
 * a lean destroyer at a glance, and `bow` is how much of the length the entry takes.
 */
function hull(length: number, beam: number, bow: number): string {
  const stern = 1.2;
  const nose = length - 0.8;
  return [
    `M ${stern + 1.6} ${AXIS - beam}`,
    `L ${nose - bow} ${AXIS - beam}`,
    `C ${nose - bow * 0.35} ${AXIS - beam} ${nose - 1} ${AXIS - beam * 0.4} ${nose} ${AXIS}`,
    `C ${nose - 1} ${AXIS + beam * 0.4} ${nose - bow * 0.35} ${AXIS + beam} ${nose - bow} ${AXIS + beam}`,
    `L ${stern + 1.6} ${AXIS + beam}`,
    `Q ${stern} ${AXIS + beam} ${stern} ${AXIS + beam - 1.6}`,
    `L ${stern} ${AXIS - beam + 1.6}`,
    `Q ${stern} ${AXIS - beam} ${stern + 1.6} ${AXIS - beam}`,
    'Z',
  ].join(' ');
}

function Hull({ d, paint }: { readonly d: string; readonly paint: Paint }) {
  return <path d={d} className="ship-hull" fill={paint.hull} stroke="var(--ship-line)" />;
}

/**
 * The machined look comes from two hairlines inset from the outline: a bright one where light
 * catches the sheer, and a soft dark one at the waterline.
 */
function Sheer({
  length,
  beam,
  bow,
}: {
  readonly length: number;
  readonly beam: number;
  readonly bow: number;
}) {
  const from = 3;
  const to = length - bow - 1.5;
  return (
    <g fill="none" strokeLinecap="round">
      <path
        d={`M ${from} ${AXIS - beam + 1} H ${to}`}
        stroke="var(--ship-hull-light)"
        strokeWidth="0.8"
        opacity="0.85"
      />
      <path
        d={`M ${from} ${AXIS + beam - 1} H ${to}`}
        stroke="var(--ship-hull-dark)"
        strokeWidth="0.8"
        opacity="0.4"
      />
    </g>
  );
}

/** Weather deck: a lighter inset panel that gives the flat top-down shape its volume. */
function Deck({
  from,
  to,
  beam,
  paint,
}: {
  readonly from: number;
  readonly to: number;
  readonly beam: number;
  readonly paint: Paint;
}) {
  return (
    <rect
      x={from}
      y={AXIS - beam}
      width={to - from}
      height={beam * 2}
      rx={beam * 0.7}
      fill={paint.deck}
      opacity="0.85"
    />
  );
}

/** Superstructure: the pale central island a warship is recognised by from above. */
function Island({
  from,
  to,
  beam,
}: {
  readonly from: number;
  readonly to: number;
  readonly beam: number;
}) {
  return (
    <g>
      <rect
        x={from}
        y={AXIS - beam}
        width={to - from}
        height={beam * 2}
        rx={beam * 0.35}
        fill="var(--ship-island)"
      />
      <rect
        x={from + 0.6}
        y={AXIS - beam + 0.5}
        width={to - from - 1.2}
        height={beam * 0.6}
        rx={beam * 0.25}
        fill="var(--ship-hull-light)"
        opacity="0.5"
      />
    </g>
  );
}

/** Main gun turret: barbette plus barrels trained forward. */
function Turret({ x, radius }: { readonly x: number; readonly radius: number }) {
  return (
    <g>
      <circle cx={x} cy={AXIS} r={radius} fill="var(--ship-detail)" />
      <circle
        cx={x}
        cy={AXIS - radius * 0.3}
        r={radius * 0.5}
        fill="var(--ship-hull-light)"
        opacity="0.4"
      />
      <path
        d={`M ${x} ${AXIS - radius * 0.4} H ${x + radius * 2.4} M ${x} ${AXIS + radius * 0.4} H ${x + radius * 2.4}`}
        stroke="var(--ship-detail)"
        strokeWidth="0.8"
        strokeLinecap="round"
      />
    </g>
  );
}

/** Funnel: a small dark stack, lit on its forward face. */
function Funnel({
  x,
  width,
  beam,
}: {
  readonly x: number;
  readonly width: number;
  readonly beam: number;
}) {
  return (
    <rect
      x={x}
      y={AXIS - beam}
      width={width}
      height={beam * 2}
      rx={width * 0.42}
      fill="var(--ship-detail)"
    />
  );
}

/** Mast: a thin athwartships line, the detail that keeps the small ships from looking bare. */
function Mast({ x, beam }: { readonly x: number; readonly beam: number }) {
  return (
    <path
      d={`M ${x} ${AXIS - beam} V ${AXIS + beam}`}
      stroke="var(--ship-detail)"
      strokeWidth="0.7"
      strokeLinecap="round"
      opacity="0.8"
    />
  );
}

/** Carrier: the widest hull, an angled flight deck with a landing strip and a starboard island. */
function Carrier(length: number, paint: Paint) {
  const beam = 8.2;
  const nose = length - 1;
  // The deck overhangs to port aft and is cut away forward: the unmistakable flat-top plan.
  const deck = [
    `M 2.6 ${AXIS - beam}`,
    `L ${nose - 16} ${AXIS - beam}`,
    `C ${nose - 6} ${AXIS - beam} ${nose - 1} ${AXIS - 3} ${nose} ${AXIS}`,
    `C ${nose - 1} ${AXIS + 3} ${nose - 6} ${AXIS + beam} ${nose - 16} ${AXIS + beam}`,
    `L 4 ${AXIS + beam}`,
    `Q 1.4 ${AXIS + beam} 1.6 ${AXIS + beam - 3}`,
    `L 2.6 ${AXIS - beam + 1.4}`,
    `Q 2.6 ${AXIS - beam} 2.6 ${AXIS - beam}`,
    'Z',
  ].join(' ');
  return (
    <>
      <Hull d={deck} paint={paint} />
      {/* Angled landing strip aft, straight take-off strip forward. */}
      <path
        d={`M 5.5 ${AXIS + 4.6} L ${length * 0.34} ${AXIS - 3.6}`}
        stroke="var(--ship-hull-light)"
        strokeWidth="0.8"
        strokeLinecap="round"
        opacity="0.6"
        fill="none"
      />
      <path
        d={`M ${length * 0.16} ${AXIS - 1.2} H ${length - 16}`}
        stroke="var(--ship-hull-light)"
        strokeWidth="0.7"
        strokeDasharray="2.5 3.5"
        opacity="0.65"
        fill="none"
      />
      {/* Island and funnel sit off-centre against the starboard deck edge, as on a real flat-top. */}
      <g transform={`translate(0 ${beam - 3.6})`}>
        <Island from={length * 0.5} to={length * 0.68} beam={2.6} />
        <Funnel x={length * 0.58} width={1.8} beam={1.9} />
      </g>
    </>
  );
}

/** Battleship: deep armoured hull, two main turrets and a tall bridge amidships. */
function Battleship(length: number, paint: Paint) {
  const beam = 6.9;
  const bow = 15;
  return (
    <>
      <Hull d={hull(length, beam, bow)} paint={paint} />
      <Sheer length={length} beam={beam} bow={bow} />
      <Deck from={4.5} to={length - bow - 1} beam={beam - 2.1} paint={paint} />
      <Turret x={length * 0.17} radius={2.5} />
      <Island from={length * 0.31} to={length * 0.5} beam={4.4} />
      <Funnel x={length * 0.42} width={2.6} beam={3} />
      <Mast x={length * 0.55} beam={2.6} />
      <Turret x={length * 0.63} radius={2.5} />
    </>
  );
}

/** Cruiser: leaner hull, one forward turret, a single funnel and a long clean quarterdeck. */
function Cruiser(length: number, paint: Paint) {
  const beam = 5.4;
  const bow = 16;
  return (
    <>
      <Hull d={hull(length, beam, bow)} paint={paint} />
      <Sheer length={length} beam={beam} bow={bow} />
      <Deck from={4} to={length - bow - 1} beam={beam - 1.8} paint={paint} />
      <Island from={length * 0.3} to={length * 0.44} beam={3.4} />
      <Funnel x={length * 0.47} width={2.4} beam={2.6} />
      <Mast x={length * 0.53} beam={2.2} />
      <Turret x={length * 0.6} radius={2.1} />
    </>
  );
}

/** Submarine: a rounded pressure hull with a sail — blunt at both ends, unlike the rest. */
function Submarine(length: number, paint: Paint) {
  const beam = 5.8;
  const body = [
    `M 8 ${AXIS - beam}`,
    `C 3 ${AXIS - beam} 1.2 ${AXIS - 2} 1.2 ${AXIS}`,
    `C 1.2 ${AXIS + 2} 3 ${AXIS + beam} 8 ${AXIS + beam}`,
    `L ${length - 9} ${AXIS + beam}`,
    `C ${length - 3} ${AXIS + beam} ${length - 1} ${AXIS + 2} ${length - 1} ${AXIS}`,
    `C ${length - 1} ${AXIS - 2} ${length - 3} ${AXIS - beam} ${length - 9} ${AXIS - beam}`,
    'Z',
  ].join(' ');
  return (
    <>
      <Hull d={body} paint={paint} />
      {/* Pressure-hull sheen along the spine, so the tube reads as round rather than flat. */}
      <path
        d={`M 7 ${AXIS - beam + 1.6} H ${length - 8}`}
        stroke="var(--ship-hull-light)"
        strokeWidth="1.7"
        strokeLinecap="round"
        opacity="0.8"
        fill="none"
      />
      <path
        d={`M 7 ${AXIS + beam - 1.4} H ${length - 8}`}
        stroke="var(--ship-hull-dark)"
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity="0.4"
        fill="none"
      />
      {/* Sail with periscopes forward and dive planes aft: no surface ship has this profile. */}
      <Island from={length * 0.36} to={length * 0.5} beam={4.2} />
      <path
        d={`M ${length * 0.44} ${AXIS - 4.2} V ${AXIS - 7.4} M ${length * 0.47} ${AXIS - 4.2} V ${AXIS - 6.2}`}
        stroke="var(--ship-detail)"
        strokeWidth="0.8"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d={`M ${length * 0.16} ${AXIS - beam + 1} V ${AXIS + beam - 1}`}
        stroke="var(--ship-detail)"
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity="0.7"
        fill="none"
      />
    </>
  );
}

/** Destroyer: the shortest hull, sharply raked, with one gun and a single funnel. */
function Destroyer(length: number, paint: Paint) {
  const beam = 4.6;
  const bow = 13;
  return (
    <>
      <Hull d={hull(length, beam, bow)} paint={paint} />
      <Sheer length={length} beam={beam} bow={bow} />
      <Deck from={3.4} to={length - bow - 1} beam={beam - 1.5} paint={paint} />
      <Island from={length * 0.3} to={length * 0.46} beam={3} />
      <Funnel x={length * 0.5} width={2.2} beam={2.3} />
      <Turret x={length * 0.63} radius={1.9} />
    </>
  );
}

const BODY: Readonly<Record<ShipId, (length: number, paint: Paint) => React.ReactNode>> = {
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
 * drawing under a quarter-turn transform, so rotating during placement rotates the actual vessel
 * — including its shading, since the gradients turn with it.
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
  // Gradients are per-instance: several sprites of the same class can share a page.
  const base = useId().replace(/[^\w-]/g, '');
  const paint: Paint = { hull: `url(#${base}-hull)`, deck: `url(#${base}-deck)` };

  return (
    <svg
      viewBox={vertical ? `0 0 ${UNIT} ${length}` : `0 0 ${length} ${UNIT}`}
      aria-hidden
      focusable="false"
      data-ship={shipId}
      style={style}
      className={`ship-sprite ${TONE_CLASS[tone]} ${className}`}
    >
      <defs>
        {/* Brushed steel: lit sheer, mid-tone flank, graphite at the waterline. */}
        <linearGradient id={`${base}-hull`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--ship-hull-light)" />
          <stop offset="45%" stopColor="var(--ship-hull)" />
          <stop offset="100%" stopColor="var(--ship-hull-dark)" />
        </linearGradient>
        <linearGradient id={`${base}-deck`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--ship-hull-light)" />
          <stop offset="100%" stopColor="var(--ship-deck)" />
        </linearGradient>
      </defs>
      <g transform={vertical ? `translate(${UNIT} 0) rotate(90)` : undefined}>
        {BODY[shipId](length, paint)}
      </g>
    </svg>
  );
}
