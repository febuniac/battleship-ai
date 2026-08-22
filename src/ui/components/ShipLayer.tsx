import { shipSpec } from '../../engine/rules.ts';
import type { Coord, Orientation, ShipId } from '../../engine/types.ts';
import { ShipSprite, type ShipTone } from './ShipSprite.tsx';

export interface ShipVisual {
  readonly shipId: ShipId;
  readonly origin: Coord;
  readonly orientation: Orientation;
  readonly tone: ShipTone;
}

/** Entry animation per tone: appearing, turning under the cursor, or going down. */
const TONE_ANIMATION: Readonly<Record<ShipTone, string>> = {
  fleet: 'animate-ship-place',
  ghost: 'animate-ship-turn',
  invalid: 'animate-ship-turn',
  wreck: 'animate-ship-sink',
};

function gridArea({ origin, orientation, shipId }: ShipVisual): React.CSSProperties {
  const { size } = shipSpec(shipId);
  return orientation === 'horizontal'
    ? { gridColumn: `${origin.c + 1} / span ${size}`, gridRow: `${origin.r + 1}` }
    : { gridColumn: `${origin.c + 1}`, gridRow: `${origin.r + 1} / span ${size}` };
}

/**
 * Ships drawn as single objects spanning the cells they occupy, on a grid that mirrors the cell
 * grid exactly. Purely decorative: it sits *behind* the cell buttons and takes no pointer events,
 * so interaction, focus and announcements stay entirely with the cells.
 *
 * The React key includes position, orientation and tone, so a ship that moves, turns or sinks
 * remounts and replays its animation.
 */
export function ShipLayer({ ships }: { readonly ships: readonly ShipVisual[] }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 grid grid-cols-10 grid-rows-10 gap-px sm:gap-0.5"
    >
      {ships.map((ship) => (
        <div
          key={`${ship.shipId}:${ship.origin.r},${ship.origin.c}:${ship.orientation}:${ship.tone}`}
          style={gridArea(ship)}
          className={`flex items-center justify-center ${TONE_ANIMATION[ship.tone]}`}
        >
          <ShipSprite
            shipId={ship.shipId}
            orientation={ship.orientation}
            tone={ship.tone}
            className="h-full w-full overflow-visible"
          />
        </div>
      ))}
    </div>
  );
}
