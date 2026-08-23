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
 * Every row is a tappable card rather than a line of type: on a touch screen there is no hover to
 * discover them with, so each one carries its own surface, a 48px target, and a state — waiting,
 * selected, or already on the water.
 */
export function ShipTray({ board, selected, onSelect }: ShipTrayProps) {
  const longest = Math.max(...FLEET.map((spec) => spec.size));

  return (
    <div className="flex flex-col gap-2">
      <h3 className="px-1 text-[0.7rem] font-medium tracking-[0.18em] text-ink-soft uppercase">
        Your fleet
      </h3>

      <ul aria-label="Fleet" className="flex flex-col gap-1.5">
        {FLEET.map((spec) => {
          const placed = findShip(board, spec.id) !== undefined;
          const isSelected = selected === spec.id;

          return (
            <li key={spec.id}>
              <button
                type="button"
                data-ship-row={spec.id}
                data-placed={placed}
                data-selected={isSelected}
                aria-pressed={isSelected}
                aria-label={`${spec.name}, ${spec.size} cells${placed ? ', placed' : ''}`}
                onClick={() => onSelect(spec.id)}
                className={`flex min-h-12 w-full touch-manipulation items-center gap-3 rounded-xl px-3 py-2 text-left transition-[background-color,box-shadow] ${
                  isSelected
                    ? 'glass ring-2 ring-inset ring-ink/70'
                    : 'bg-white/45 ring-1 ring-inset ring-ink/12 hover:bg-white/70'
                }`}
              >
                <span className="flex w-[4.5rem] shrink-0 flex-col leading-tight">
                  <span
                    className={`text-[0.8rem] ${placed && !isSelected ? 'font-normal text-ink-soft' : 'font-medium text-ink'}`}
                  >
                    {spec.name}
                  </span>
                  {/* "cells", not a count: one Carrier occupying five cells. */}
                  <span className="text-[0.6rem] tracking-[0.1em] text-ink-faint">
                    <span className="tabular-nums">{spec.size}</span> cells
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

                {/*
                 * The row says where the ship is in the flow, in a word: the one being placed, or
                 * one already on the water. Redundant with the surface, on purpose.
                 */}
                <span
                  aria-hidden
                  className={`w-[4rem] shrink-0 text-right text-[0.6rem] font-medium tracking-[0.1em] uppercase ${
                    isSelected ? 'text-ink' : 'text-ink-faint'
                  }`}
                >
                  {isSelected ? 'Selected' : placed ? 'Placed' : ''}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
