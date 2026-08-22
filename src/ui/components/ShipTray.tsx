import { findShip } from '../../engine/board.ts';
import { FLEET } from '../../engine/rules.ts';
import type { Board, ShipId } from '../../engine/types.ts';
import { ShipSprite } from './ShipSprite.tsx';

export interface ShipTrayProps {
  readonly board: Board;
  readonly selected: ShipId | null;
  /** Selecting an already-placed ship lifts it off the board, so no separate remove control. */
  readonly onSelect: (shipId: ShipId) => void;
}

/**
 * The fleet roster: name, length, and the same silhouette that will appear on the water, drawn at
 * a width proportional to the ship's length so the tray and the board read as the same objects.
 *
 * Rows are type on the page rather than cards — only the selected ship gets a surface.
 */
export function ShipTray({ board, selected, onSelect }: ShipTrayProps) {
  const longest = Math.max(...FLEET.map((spec) => spec.size));

  return (
    <ul aria-label="Fleet" className="flex flex-col gap-1">
      {FLEET.map((spec) => {
        const placed = findShip(board, spec.id) !== undefined;
        const isSelected = selected === spec.id;

        return (
          <li key={spec.id}>
            <button
              type="button"
              data-ship-row={spec.id}
              data-placed={placed}
              aria-pressed={isSelected}
              aria-label={`${spec.name}, ${spec.size} cells${placed ? ', placed' : ''}`}
              onClick={() => onSelect(spec.id)}
              className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-1.5 text-left transition-colors ${
                isSelected ? 'glass' : 'hover:bg-white/55'
              }`}
            >
              <span className="flex w-[4.5rem] shrink-0 flex-col leading-tight">
                <span
                  className={`text-[0.8rem] ${placed ? 'font-normal text-ink-soft' : 'font-medium text-ink'}`}
                >
                  {spec.name}
                </span>
                <span className="text-[0.6rem] tracking-[0.1em] text-ink-faint tabular-nums">
                  {spec.size}
                </span>
              </span>

              {/* Proportional width: the Destroyer is visibly a smaller vessel than the Carrier. */}
              <span aria-hidden className="flex min-w-0 flex-1 items-center">
                <ShipSprite
                  shipId={spec.id}
                  tone={placed ? 'fleet' : 'ghost'}
                  className="h-6"
                  style={{ width: `${(spec.size / longest) * 100}%` }}
                />
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
