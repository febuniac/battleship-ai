import { useCallback, useEffect, useMemo, useState } from 'react';
import { coordKey, coordLabel, findShip, shipAt, shipFootprint } from '../engine/board.ts';
import { FLEET, shipSpec } from '../engine/rules.ts';
import type { Coord, Orientation, ShipId } from '../engine/types.ts';
import { AppHeader } from './components/AppHeader.tsx';
import { Board } from './components/Board.tsx';
import type { CellVariant } from './components/Cell.tsx';
import { LiveRegion } from './components/LiveRegion.tsx';
import type { ShipVisual } from './components/ShipLayer.tsx';
import { ShipTray } from './components/ShipTray.tsx';
import { StatusLine } from './components/StatusLine.tsx';
import { placementReasonText } from './messages.ts';
import type { Game } from './useGame.ts';

const CONTROL =
  'glass-button min-h-11 rounded-full px-4 text-xs whitespace-nowrap sm:text-[0.8rem]';

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
      shipId: activeShip,
      origin: hover,
      orientation,
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

  /*
   * Placed ships plus, when hovering, a ghost of the ship being placed. An out-of-bounds ghost is
   * skipped: only the cells' negative state can show a footprint that leaves the board.
   */
  const ships: readonly ShipVisual[] = [
    ...board.ships.map((ship): ShipVisual => ({
      shipId: ship.id,
      origin: ship.origin,
      orientation: ship.orientation,
      tone: 'fleet',
    })),
    ...(preview && preview.reason !== 'OUT_OF_BOUNDS'
      ? [
          {
            shipId: preview.shipId,
            origin: preview.origin,
            orientation: preview.orientation,
            tone: preview.reason === null ? ('ghost' as const) : ('invalid' as const),
          },
        ]
      : []),
  ];

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

  const status = preview
    ? {
        tone: preview.reason === null ? ('valid' as const) : ('invalid' as const),
        text: preview.text,
      }
    : fleetComplete
      ? { tone: 'valid' as const, text: 'Fleet ready' }
      : {
          tone: 'neutral' as const,
          text: activeShip
            ? `Placing ${shipSpec(activeShip).name} — press R to rotate`
            : 'Pick a ship to place it',
        };

  return (
    <div className="mx-auto flex w-full max-w-[62rem] flex-col gap-8 sm:gap-10">
      <LiveRegion message={announcement} />

      <AppHeader>
        <h2 className="text-sm font-light tracking-[0.14em] text-ink-soft uppercase">
          Deploy your fleet
        </h2>
      </AppHeader>

      <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_15rem] lg:gap-14">
        <Board
          label="Your waters"
          side="friendly"
          variantAt={variantAt}
          ships={ships}
          onSelect={onCellSelect}
          onHover={setHover}
          {...(autoFocusBoard ? { focusKey: game.generation } : {})}
        />

        <div className="flex flex-col gap-6">
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
          />

          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={rotate} className={CONTROL}>
                Rotate
              </button>
              <button
                type="button"
                onClick={() => {
                  game.randomize();
                  setSelected(null);
                  setAnnouncement('Fleet placed at random');
                }}
                className={CONTROL}
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
                className={CONTROL}
              >
                Clear
              </button>
            </div>
            <button
              type="button"
              disabled={!fleetComplete}
              onClick={() => game.start()}
              className="min-h-11 rounded-full bg-ink px-4 text-sm font-medium text-paper transition-[background-color,opacity] hover:bg-ink/90 disabled:bg-ink/12 disabled:text-ink-faint"
            >
              Begin battle
            </button>
          </div>
        </div>
      </div>

      <StatusLine tone={status.tone}>{status.text}</StatusLine>
      <p className="sr-only">Keyboard: arrow keys move across the grid, Enter places, R rotates.</p>
    </div>
  );
}
