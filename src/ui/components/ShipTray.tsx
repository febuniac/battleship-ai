import { FLEET } from '../../engine/rules.ts';
import type { Board, ShipId } from '../../engine/types.ts';
import { findShip } from '../../engine/board.ts';

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
              className={`flex items-center gap-3 rounded border px-3 py-2 ${
                isSelected ? 'border-sky-400 bg-sky-500/10' : 'border-slate-700 bg-slate-800/60'
              }`}
            >
              <button
                type="button"
                aria-pressed={isSelected}
                onClick={() => onSelect(spec.id)}
                className="flex flex-1 items-center gap-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400"
              >
                <span className="flex-1 text-sm text-slate-100">{spec.name}</span>
                <span aria-hidden className="flex gap-0.5">
                  {Array.from({ length: spec.size }, (_unused, index) => (
                    <span
                      key={index}
                      className={`h-2.5 w-2.5 rounded-sm ${placed ? 'bg-emerald-400' : 'bg-slate-600'}`}
                    />
                  ))}
                </span>
                <span className="w-16 text-right text-xs text-slate-400">
                  {placed ? 'Placed' : `${spec.size} cells`}
                </span>
              </button>

              {placed ? (
                <button
                  type="button"
                  onClick={() => onRemove(spec.id)}
                  className="rounded border border-slate-600 px-2 py-0.5 text-xs text-slate-300 hover:border-rose-400 hover:text-rose-200"
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
