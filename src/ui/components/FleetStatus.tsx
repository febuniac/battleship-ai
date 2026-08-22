import { findShip, isSunk } from '../../engine/board.ts';
import { FLEET } from '../../engine/rules.ts';
import type { Board } from '../../engine/types.ts';

export interface FleetStatusProps {
  readonly label: string;
  /** The fleet's own board, so sunk state comes from the engine's hit counts. */
  readonly board: Board;
  /** Hide which ships are still afloat where the player is not entitled to know. */
  readonly revealAfloat: boolean;
}

export function FleetStatus({ label, board, revealAfloat }: FleetStatusProps) {
  const sunkCount = board.ships.filter(isSunk).length;

  return (
    <section aria-label={label} className="flex flex-col gap-1.5">
      <h3 className="flex items-baseline gap-2 text-xs font-semibold tracking-[0.08em] text-slate-400 uppercase">
        {label}
        <span className="text-slate-500 normal-case">
          {sunkCount}/{FLEET.length} sunk
        </span>
      </h3>
      <ul className="flex flex-wrap gap-1.5">
        {FLEET.map((spec) => {
          const ship = findShip(board, spec.id);
          const sunk = ship !== undefined && isSunk(ship);
          return (
            <li
              key={spec.id}
              className={`flex items-center gap-1 rounded px-2 py-1 text-xs ${
                sunk
                  ? 'bg-rose-800 text-rose-50'
                  : revealAfloat
                    ? 'bg-sea-700 text-slate-200'
                    : 'bg-sea-800 text-slate-400'
              }`}
            >
              {sunk ? <span aria-hidden>✕</span> : null}
              <span className={sunk ? 'line-through' : ''}>{spec.name}</span>
              <span aria-hidden className="text-[0.65rem] opacity-70">
                {spec.size}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
