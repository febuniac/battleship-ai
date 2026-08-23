import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  coordKey,
  coordLabel,
  findShip,
  sameCoord,
  shipAt,
  shipFootprint,
} from '../engine/board.ts';
import { FLEET, shipSpec } from '../engine/rules.ts';
import type { Coord, Orientation, ShipId } from '../engine/types.ts';
import { AppHeader } from './components/AppHeader.tsx';
import { Board, type BoardHud } from './components/Board.tsx';
import { BoardIntro } from './components/BoardIntro.tsx';
import type { CellVariant } from './components/Cell.tsx';
import { LiveRegion } from './components/LiveRegion.tsx';
import type { ShipVisual } from './components/ShipLayer.tsx';
import { ShipTray } from './components/ShipTray.tsx';
import { StatusLine } from './components/StatusLine.tsx';
import { placementReasonText } from './messages.ts';
import type { Game } from './useGame.ts';
import { useCoarsePointer } from './useCoarsePointer.ts';

const CONTROL =
  'glass-button min-h-11 touch-manipulation rounded-full px-4 text-xs whitespace-nowrap sm:text-[0.8rem]';

/** The instruction the screen opens on, and the one it switches to once a ship is in hand. */
const PICK_SHIP = 'Tap a ship below, then tap the board to place it.';
const PLACE_SHIP = 'Now tap the board to place it.';

function RotateIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="h-4 w-4">
      <path
        d="M20 12a8 8 0 1 1-2.5-5.8M20 4v4h-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export interface PlacementScreenProps {
  readonly game: Game;
  /** Set when arriving from a finished game, where focus would otherwise be lost. */
  readonly autoFocusBoard?: boolean;
  /** Whether the stage's one-time introduction is still owed to the player. */
  readonly intro?: boolean;
  readonly onIntroDismiss?: () => void;
}

export function PlacementScreen({
  game,
  autoFocusBoard = false,
  intro = false,
  onIntroDismiss,
}: PlacementScreenProps) {
  const board = game.state.boards.human;
  const [selected, setSelected] = useState<ShipId | null>(FLEET[0]?.id ?? null);
  const [orientation, setOrientation] = useState<Orientation>('horizontal');
  const [hover, setHover] = useState<Coord | null>(null);
  /** The square a tap aimed at, on a screen where nothing can be hovered first. */
  const [tapTarget, setTapTarget] = useState<Coord | null>(null);
  const [announcement, setAnnouncement] = useState('');
  /**
   * The last thing the player did to their fleet, so the board can answer it: a ship taken from
   * the tray gets an instruction, a ship that just landed gets a confirmation.
   */
  const [lastAction, setLastAction] = useState<{
    readonly kind: 'selected' | 'placed';
    readonly ship: ShipId;
  } | null>(null);
  const coarsePointer = useCoarsePointer();

  const fleetComplete = board.ships.length === FLEET.length;
  const activeShip = selected !== null && findShip(board, selected) === undefined ? selected : null;
  /*
   * Where the drop is being aimed. A pointer aims by hovering; a finger has to aim by tapping,
   * so the first tap only marks the square and the ship is committed by a second one. On a touch
   * screen hovering is ignored outright: browsers emulate it on tap, which would otherwise let a
   * single tap look like an aimed pointer and place the ship without a preview.
   */
  const aim = coarsePointer ? tapTarget : (hover ?? tapTarget);
  const awaitingConfirm = coarsePointer && tapTarget !== null && activeShip !== null;

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
    if (activeShip === null || aim === null) return null;
    const cells = shipFootprint(aim, orientation, shipSpec(activeShip).size);
    const reason = game.checkPlacement(activeShip, aim, orientation);
    return {
      keys: new Set(cells.map((cell) => coordKey(cell))),
      reason,
      shipId: activeShip,
      origin: aim,
      orientation,
      text:
        reason === null
          ? `${shipSpec(activeShip).name} fits here`
          : placementReasonText(board, activeShip, aim, orientation, reason),
    };
  }, [activeShip, aim, orientation, game, board]);

  const variantAt = (at: Coord): CellVariant => {
    if (preview?.keys.has(coordKey(at)) === true) {
      return preview.reason === null ? 'previewValid' : 'previewInvalid';
    }
    return shipAt(board, at) ? 'ship' : 'water';
  };

  /*
   * Placed ships plus, when aiming, a ghost of the ship being placed. An out-of-bounds ghost is
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

  const place = (at: Coord) => {
    if (activeShip === null) return;
    const rejection = game.place(activeShip, at, orientation);
    if (rejection !== null) {
      setAnnouncement(placementReasonText(board, activeShip, at, orientation, rejection));
      return;
    }

    setTapTarget(null);
    setAnnouncement(`${shipSpec(activeShip).name} placed at ${coordLabel(at)}, ${orientation}`);
    setLastAction({ kind: 'placed', ship: activeShip });
    // `board` predates this placement, so the ship just placed is excluded explicitly.
    const next = FLEET.find(
      (spec) => spec.id !== activeShip && findShip(board, spec.id) === undefined,
    );
    setSelected(next?.id ?? null);
  };

  const onCellSelect = (at: Coord) => {
    const existing = shipAt(board, at);
    /*
     * A cell holding a ship only picks that ship back up when nothing is waiting to be placed.
     * While a ship is being placed the tap stays a placement attempt, so an overlapping attempt
     * is rejected by the engine and leaves the placed ship untouched.
     */
    if (existing && activeShip === null) {
      game.remove(existing.id);
      setSelected(existing.id);
      setOrientation(existing.orientation);
      setTapTarget(null);
      setLastAction({ kind: 'selected', ship: existing.id });
      setAnnouncement(`${shipSpec(existing.id).name} removed`);
      return;
    }

    if (activeShip === null) {
      setAnnouncement('Tap a ship in your fleet first');
      return;
    }

    /*
     * On a touch screen the tap has to do the aiming the pointer would have done by hovering:
     * the first tap on a square previews the ship there, and only a tap on that same square (or
     * the confirm button) commits it. With a pointer the preview is already on screen, so a
     * click places straight away.
     */
    if (coarsePointer && (tapTarget === null || !sameCoord(tapTarget, at))) {
      setTapTarget(at);
      const reason = game.checkPlacement(activeShip, at, orientation);
      setAnnouncement(
        reason === null
          ? `${shipSpec(activeShip).name} at ${coordLabel(at)}, tap again to place`
          : placementReasonText(board, activeShip, at, orientation, reason),
      );
      return;
    }

    place(at);
  };

  const selectShip = (shipId: ShipId) => {
    const placed = findShip(board, shipId);
    if (placed) {
      game.remove(shipId);
      setOrientation(placed.orientation);
    }
    setSelected(shipId);
    setTapTarget(null);
    setLastAction({ kind: 'selected', ship: shipId });
    setAnnouncement(`${shipSpec(shipId).name} selected`);
  };

  /*
   * The board's own instruction, following the player: what to do, whether this spot works, and
   * what to do next. One line in one place, so there is never a second thing to read.
   */
  const hud: BoardHud = fleetComplete
    ? { tone: 'valid', text: 'Fleet ready. Begin battle.' }
    : preview
      ? preview.reason !== null
        ? { tone: 'invalid', text: 'That position is unavailable.' }
        : awaitingConfirm
          ? { tone: 'valid', text: `Tap again to place your ${shipSpec(preview.shipId).name}.` }
          : { tone: 'valid', text: `Place ${shipSpec(preview.shipId).name} here.` }
      : /*
         * The Carrier is in hand from the start, but a player who has not touched anything yet is
         * owed the whole interaction rather than its second half, so the opening line teaches both
         * steps and only a ship the player put in hand switches it to the next move.
         */
        activeShip !== null && lastAction !== null
        ? { tone: 'neutral', text: PLACE_SHIP }
        : { tone: 'neutral', text: PICK_SHIP };

  const status = preview
    ? {
        tone: preview.reason === null ? ('valid' as const) : ('invalid' as const),
        text: preview.text,
      }
    : fleetComplete
      ? { tone: 'valid' as const, text: 'Fleet ready' }
      : lastAction?.kind === 'placed'
        ? { tone: 'valid' as const, text: `${shipSpec(lastAction.ship).name} placed` }
        : {
            tone: 'neutral' as const,
            text: activeShip
              ? `Placing ${shipSpec(activeShip).name} — Rotate changes direction`
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

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_16rem] lg:gap-14">
        {/*
         * On the wide layout the board is the only thing above the fold, so its width is bounded
         * by the height left for it: the tenth row stays visible instead of falling off-screen.
         */}
        <div className="w-full lg:[max-width:min(100%,calc(100svh-19rem))]">
          <Board
            label="Your waters"
            hud={hud}
            side="friendly"
            variantAt={variantAt}
            ships={ships}
            onSelect={onCellSelect}
            onHover={setHover}
            disabled={intro}
            {...(intro
              ? {
                  overlay: (
                    <BoardIntro
                      title="Place your fleet"
                      detail="Tap a ship below, then tap the board to place it. Tap rotate to change direction."
                      action="Got it"
                      onDismiss={() => onIntroDismiss?.()}
                    />
                  ),
                }
              : {})}
            {...(autoFocusBoard && !intro ? { focusKey: game.generation } : {})}
          />
        </div>

        <div className="flex flex-col gap-4">
          {/*
           * Rotation is a control, not a shortcut: on a touch screen `R` does not exist, so the
           * button carries the current direction and sits between the board and the ships.
           */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={rotate}
              aria-label={`Rotate ship, currently ${orientation}`}
              data-orientation={orientation}
              className="glass-button flex min-h-12 flex-1 touch-manipulation items-center justify-center gap-2 rounded-full px-4 text-sm font-medium"
            >
              <RotateIcon />
              Rotate
              <span className="text-xs font-normal text-ink-soft capitalize">{orientation}</span>
            </button>
          </div>

          {/*
           * The commit, spelled out: a tap-aimed placement never has to be guessed at, and the
           * button says exactly which ship lands where.
           */}
          {awaitingConfirm && preview && !fleetComplete ? (
            <button
              type="button"
              data-testid="confirm-placement"
              disabled={preview.reason !== null}
              onClick={() => {
                place(preview.origin);
              }}
              className="min-h-12 touch-manipulation rounded-full bg-ink px-4 text-sm font-medium text-paper transition-[background-color,opacity] hover:bg-ink/90 disabled:bg-ink/12 disabled:text-ink-faint"
            >
              {preview.reason === null
                ? `Place ${shipSpec(preview.shipId).name} at ${coordLabel(preview.origin)}`
                : 'That position is unavailable'}
            </button>
          ) : null}

          <ShipTray board={board} selected={activeShip} onSelect={selectShip} />

          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  game.randomize();
                  setSelected(null);
                  setTapTarget(null);
                  setLastAction(null);
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
                  setTapTarget(null);
                  setLastAction(null);
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
              className="min-h-12 touch-manipulation rounded-full bg-ink px-4 text-sm font-medium text-paper transition-[background-color,opacity] hover:bg-ink/90 disabled:bg-ink/12 disabled:text-ink-faint"
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
