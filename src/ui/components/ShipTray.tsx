import { findShip } from '../../engine/board.ts';
import { FLEET } from '../../engine/rules.ts';
import type { Board, ShipId } from '../../engine/types.ts';

export interface ShipTrayProps {
  readonly board: Board;
  readonly selected: ShipId | null;
  readonly onSelect: (shipId: ShipId) => void;
  readonly onRemove: (shipId: ShipId) => void;
}

export function ShipTray({ board, selected, onSelect, onRemove }: ShipTrayProps) {
  return (
    <ul aria-label="Fleet" className="flex flex-col gap-1.5">
      {FLEET.map((spec) => {
        const placed = findShip(board, spec.id) !== undefined;
        const isSelected = selected === spec.id;

        return (
          <li key={spec.id}>
            <div
              className={`flex items-stretch gap-2 rounded-md border transition-colors ${
                isSelected
                  ? 'border-sky-400 bg-sky-500/10'
                  : placed
                    ? 'border-sea-700 bg-emerald-500/5'
                    : 'border-sea-700 bg-sea-800/60'
              }`}
            >
              <button
                type="button"
                aria-pressed={isSelected}
                onClick={() => onSelect(spec.id)}
                className="flex min-h-11 flex-1 items-center gap-3 px-3 text-left"
              >
                <span className="flex-1 text-sm font-medium text-slate-100">{spec.name}</span>
                <span aria-hidden className="flex gap-0.5">
                  {Array.from({ length: spec.size }, (_unused, index) => (
                    <span
                      key={index}
                      className={`h-2.5 w-2.5 rounded-[0.15rem] ${
                        placed ? 'bg-emerald-400' : 'bg-sea-600'
                      }`}
                    />
                  ))}
                </span>
                <span
                  className={`w-14 text-right text-xs ${placed ? 'text-emerald-300' : 'text-slate-400'}`}
                >
                  {placed ? 'Placed' : `${spec.size} cells`}
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
