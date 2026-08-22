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
    <section aria-label={label} className="flex flex-col gap-1">
      <h3 className="text-xs font-semibold tracking-wide text-slate-400 uppercase">
        {label} - {sunkCount}/{FLEET.length} sunk
      </h3>
      <ul className="flex flex-wrap gap-1.5">
        {FLEET.map((spec) => {
          const ship = findShip(board, spec.id);
          const sunk = ship !== undefined && isSunk(ship);
          return (
            <li
              key={spec.id}
              className={`rounded px-2 py-0.5 text-xs ${
                sunk
                  ? 'bg-rose-700/70 text-rose-100 line-through'
                  : revealAfloat
                    ? 'bg-slate-700 text-slate-200'
                    : 'bg-slate-800 text-slate-400'
              }`}
            >
              {spec.name} <span aria-hidden>({spec.size})</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
