import { useCallback, useEffect, useMemo, useState } from 'react';
import { coordKey, findShip, shipAt, shipFootprint } from '../engine/board.ts';
import { FLEET, shipSpec } from '../engine/rules.ts';
import type { Coord, Orientation, ShipId } from '../engine/types.ts';
import { Board } from './components/Board.tsx';
import type { CellVariant } from './components/Cell.tsx';
import { ShipTray } from './components/ShipTray.tsx';
import { ValidationHint } from './components/ValidationHint.tsx';
import { placementReasonText } from './messages.ts';
import type { Game } from './useGame.ts';

export function PlacementScreen({ game }: { readonly game: Game }) {
  const board = game.state.boards.human;
  const [selected, setSelected] = useState<ShipId | null>(FLEET[0]?.id ?? null);
  const [orientation, setOrientation] = useState<Orientation>('horizontal');
  const [hover, setHover] = useState<Coord | null>(null);

  const fleetComplete = board.ships.length === FLEET.length;
  const activeShip = selected !== null && findShip(board, selected) === undefined ? selected : null;

  const rotate = useCallback(() => {
    setOrientation((current) => (current === 'horizontal' ? 'vertical' : 'horizontal'));
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'r' || event.key === 'R') rotate();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [rotate]);

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
      return;
    }
    if (activeShip === null) return;
    if (game.place(activeShip, at, orientation) === null) {
      // `board` predates this placement, so the ship just placed is excluded explicitly.
      const next = FLEET.find(
        (spec) => spec.id !== activeShip && findShip(board, spec.id) === undefined,
      );
      setSelected(next?.id ?? null);
    }
  };

  const hint = preview
    ? {
        tone: preview.reason === null ? ('valid' as const) : ('invalid' as const),
        text: preview.text,
      }
    : fleetComplete
      ? { tone: 'valid' as const, text: 'Fleet ready - start the game' }
      : {
          tone: 'neutral' as const,
          text: activeShip
            ? `Placing ${shipSpec(activeShip).name} (${orientation}). Press R to rotate.`
            : 'Pick a ship from the tray to place it.',
        };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 lg:flex-row">
      <div className="lg:flex-1">
        <Board
          label="Your waters"
          caption="Click a cell to place the selected ship"
          variantAt={variantAt}
          onSelect={onCellSelect}
          onHover={setHover}
        />
      </div>

      <div className="flex flex-col gap-4 lg:w-72">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold text-slate-50">Deploy your fleet</h1>
          <p className="text-sm text-slate-400">
            Ships may touch but not overlap. All five must be placed.
          </p>
        </div>

        <ShipTray
          board={board}
          selected={activeShip}
          onSelect={(shipId) => {
            const placed = findShip(board, shipId);
            if (placed) game.remove(shipId);
            setSelected(shipId);
            if (placed) setOrientation(placed.orientation);
          }}
          onRemove={(shipId) => {
            game.remove(shipId);
            setSelected(shipId);
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
            }}
            className={SECONDARY_BUTTON}
          >
            Clear
          </button>
          <button
            type="button"
            disabled={!fleetComplete}
            onClick={() => game.start()}
            className="rounded bg-sky-500 px-3 py-2 text-sm font-medium text-slate-950 hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
          >
            Start game
          </button>
        </div>
      </div>
    </div>
  );
}

const SECONDARY_BUTTON =
  'rounded border border-slate-600 px-3 py-2 text-sm text-slate-200 hover:border-slate-400 hover:bg-slate-800';
