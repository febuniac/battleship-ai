import { findShip } from '../../engine/board.ts';
import { FLEET } from '../../engine/rules.ts';
import type { Board, ShipId } from '../../engine/types.ts';
import { ShipSprite } from './ShipSprite.tsx';

export interface ShipTrayProps {
  readonly board: Board;
  readonly selected: ShipId | null;
  readonly onSelect: (shipId: ShipId) => void;
  readonly onRemove: (shipId: ShipId) => void;
}

/**
 * The fleet roster. Each row shows the same silhouette that will appear on the board, at a width
 * proportional to the ship's length, so the tray and the board are obviously the same objects.
 */
export function ShipTray({ board, selected, onSelect, onRemove }: ShipTrayProps) {
  const longest = Math.max(...FLEET.map((spec) => spec.size));

  return (
    <ul aria-label="Fleet" className="flex flex-col gap-1.5">
      {FLEET.map((spec) => {
        const placed = findShip(board, spec.id) !== undefined;
        const isSelected = selected === spec.id;

        return (
          <li key={spec.id}>
            <div
              data-ship-row={spec.id}
              data-placed={placed}
              className={`flex items-stretch gap-2 rounded-md border transition-colors ${
                isSelected
                  ? 'border-sky-400 bg-sky-500/10 ring-1 ring-sky-400/40'
                  : placed
                    ? 'border-emerald-500/40 bg-emerald-500/5'
                    : 'border-sea-700 bg-sea-800/60'
              }`}
            >
              <button
                type="button"
                aria-pressed={isSelected}
                onClick={() => onSelect(spec.id)}
                className="flex min-h-11 flex-1 items-center gap-3 px-3 py-1.5 text-left"
              >
                <span className="flex w-24 shrink-0 flex-col">
                  <span className="text-sm font-medium text-slate-100">{spec.name}</span>
                  <span className="text-[0.65rem] tracking-wide text-slate-400 uppercase">
                    {spec.size} cells
                  </span>
                </span>

                {/* Proportional width: the Destroyer is visibly a smaller vessel than the Carrier. */}
                <span aria-hidden className="flex min-w-0 flex-1 items-center">
                  <ShipSprite
                    shipId={spec.id}
                    tone={placed ? 'fleet' : 'ghost'}
                    className={`h-7 ${placed ? '' : 'opacity-80'}`}
                    style={{ width: `${(spec.size / longest) * 100}%` }}
                  />
                </span>

                <span
                  className={`w-14 shrink-0 text-right text-xs ${placed ? 'text-emerald-300' : 'text-slate-400'}`}
                >
                  {placed ? 'Placed' : isSelected ? 'Placing…' : 'Ready'}
                </span>
              </button>

              {placed ? (
                <button
                  type="button"
                  aria-label={`Remove ${spec.name}`}
                  onClick={() => onRemove(spec.id)}
                  className="my-1 mr-1 min-h-9 rounded border border-sea-600 px-2 text-xs text-slate-300 hover:border-rose-400 hover:text-rose-200"
                >
                  Remove
                </button>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
