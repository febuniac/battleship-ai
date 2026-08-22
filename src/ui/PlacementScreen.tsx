import { useCallback, useEffect, useMemo, useState } from 'react';
import { coordKey, coordLabel, findShip, shipAt, shipFootprint } from '../engine/board.ts';
import { FLEET, shipSpec } from '../engine/rules.ts';
import type { Coord, Orientation, ShipId } from '../engine/types.ts';
import { Board } from './components/Board.tsx';
import type { CellVariant } from './components/Cell.tsx';
import { LiveRegion } from './components/LiveRegion.tsx';
import { ShipTray } from './components/ShipTray.tsx';
import { ValidationHint } from './components/ValidationHint.tsx';
import { placementReasonText } from './messages.ts';
import type { Game } from './useGame.ts';

export interface PlacementScreenProps {
  readonly game: Game;
  /** Set when arriving from a finished game, where focus would otherwise be lost. */
  readonly autoFocusBoard?: boolean;
}

export function PlacementScreen({ game, autoFocusBoard = false }: PlacementScreenProps) {
  const board = game.state.boards.human;
  const [selected, setSelected] = useState<ShipId | null>(FLEET[0]?.id ?? null);
  const [orientation, setOrientation] = useState<Orientation>('horizontal');
  const [hover, setHover] = useState<Coord | null>(null);
  const [announcement, setAnnouncement] = useState('');

  const fleetComplete = board.ships.length === FLEET.length;
  const activeShip = selected !== null && findShip(board, selected) === undefined ? selected : null;

  const rotate = useCallback(() => {
    const next = orientation === 'horizontal' ? 'vertical' : 'horizontal';
    setOrientation(next);
    setAnnouncement(`Orientation ${next}`);
  }, [orientation]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'r' || event.key === 'R') rotate();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [rotate]);

  // The engine decides whether the footprint is legal; the UI only draws its verdict.
  const preview = useMemo(() => {
    if (activeShip === null || hover === null) return null;
    const cells = shipFootprint(hover, orientation, shipSpec(activeShip).size);
    const reason = game.checkPlacement(activeShip, hover, orientation);
    return {
      keys: new Set(cells.map((cell) => coordKey(cell))),
      reason,
      text:
        reason === null
          ? `${shipSpec(activeShip).name} fits here`
          : placementReasonText(board, activeShip, hover, orientation, reason),
    };
  }, [activeShip, hover, orientation, game, board]);

  const variantAt = (at: Coord): CellVariant => {
    if (preview?.keys.has(coordKey(at)) === true) {
      return preview.reason === null ? 'previewValid' : 'previewInvalid';
    }
    return shipAt(board, at) ? 'ship' : 'water';
  };

  const onCellSelect = (at: Coord) => {
    const existing = shipAt(board, at);
    if (existing) {
      game.remove(existing.id);
      setSelected(existing.id);
      setOrientation(existing.orientation);
      setAnnouncement(`${shipSpec(existing.id).name} removed`);
      return;
    }

    if (activeShip === null) {
      setAnnouncement('Select a ship from the fleet list first');
      return;
    }

    const rejection = game.place(activeShip, at, orientation);
    if (rejection !== null) {
      setAnnouncement(placementReasonText(board, activeShip, at, orientation, rejection));
      return;
    }

    setAnnouncement(`${shipSpec(activeShip).name} placed at ${coordLabel(at)}, ${orientation}`);
    // `board` predates this placement, so the ship just placed is excluded explicitly.
    const next = FLEET.find(
      (spec) => spec.id !== activeShip && findShip(board, spec.id) === undefined,
    );
    setSelected(next?.id ?? null);
  };

  const hint = preview
    ? {
        tone: preview.reason === null ? ('valid' as const) : ('invalid' as const),
        text: preview.text,
      }
    : fleetComplete
      ? { tone: 'valid' as const, text: 'Fleet ready — start the game' }
      : {
          tone: 'neutral' as const,
          text: activeShip
            ? `Placing ${shipSpec(activeShip).name} (${orientation}) — press R to rotate`
            : 'Pick a ship from the fleet list to place it',
        };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
      <LiveRegion message={announcement} />

      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight text-slate-50 sm:text-2xl">
          Deploy your fleet
        </h1>
        <p className="text-sm text-slate-400">
          Ships may touch but not overlap. All five must be placed.
        </p>
      </header>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-10">
        <div className="flex flex-col gap-3 lg:flex-1">
          <Board
            label="Your waters"
            caption="Click a cell to place the selected ship"
            variantAt={variantAt}
            onSelect={onCellSelect}
            onHover={setHover}
            {...(autoFocusBoard ? { focusKey: game.generation } : {})}
          />
          <p className="text-xs text-slate-500">
            Keyboard: arrow keys move, Enter places, R rotates.
          </p>
        </div>

        <div className="flex flex-col gap-4 lg:w-80">
          <ShipTray
            board={board}
            selected={activeShip}
            onSelect={(shipId) => {
              const placed = findShip(board, shipId);
              if (placed) {
                game.remove(shipId);
                setOrientation(placed.orientation);
              }
              setSelected(shipId);
              setAnnouncement(`${shipSpec(shipId).name} selected`);
            }}
            onRemove={(shipId) => {
              game.remove(shipId);
              setSelected(shipId);
              setAnnouncement(`${shipSpec(shipId).name} removed`);
            }}
          />

          <ValidationHint tone={hint.tone}>{hint.text}</ValidationHint>

          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={rotate} className={SECONDARY_BUTTON}>
              Rotate ({orientation === 'horizontal' ? 'H' : 'V'})
            </button>
            <button
              type="button"
              onClick={() => {
                game.randomize();
                setSelected(null);
                setAnnouncement('Fleet placed at random');
              }}
              className={SECONDARY_BUTTON}
            >
              Randomize fleet
            </button>
            <button
              type="button"
              onClick={() => {
                game.clearFleet();
                setSelected(FLEET[0]?.id ?? null);
                setAnnouncement('Board cleared');
              }}
              className={SECONDARY_BUTTON}
            >
              Clear
            </button>
            <button
              type="button"
              disabled={!fleetComplete}
              onClick={() => game.start()}
              className="min-h-11 rounded-md bg-sky-500 px-3 text-sm font-medium text-sea-950 transition-colors hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-sea-700 disabled:text-slate-400"
            >
              Start game
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const SECONDARY_BUTTON =
  'min-h-11 rounded-md border border-sea-600 px-3 text-sm text-slate-200 transition-colors hover:border-slate-400 hover:bg-sea-800';
