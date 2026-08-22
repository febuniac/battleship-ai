import { useState } from 'react';
import { coordKey, isSunk, sameCoord, shipAt, shotAt } from '../engine/board.ts';
import { FLEET } from '../engine/rules.ts';
import type {
  Board as BoardModel,
  Coord,
  IllegalReason,
  LogEntry,
  Player,
} from '../engine/types.ts';
import { battleAnnouncement, describeShot } from './announcements.ts';
import { AppHeader } from './components/AppHeader.tsx';
import { Board } from './components/Board.tsx';
import type { CellAnimation, CellVariant } from './components/Cell.tsx';
import { GameOverOverlay } from './components/GameOverOverlay.tsx';
import { LiveRegion } from './components/LiveRegion.tsx';
import type { ShipVisual } from './components/ShipLayer.tsx';
import { StatusLine } from './components/StatusLine.tsx';
import { TurnBanner } from './components/TurnBanner.tsx';
import { reasonText } from './messages.ts';
import type { Game } from './useGame.ts';

/** Ships the viewer is entitled to see: their own fleet, and enemy hulls the engine reports sunk. */
function visibleShips(board: BoardModel, reveal: 'all' | 'sunkOnly'): readonly ShipVisual[] {
  return board.ships
    .filter((ship) => reveal === 'all' || isSunk(ship))
    .map((ship) => ({
      shipId: ship.id,
      origin: ship.origin,
      orientation: ship.orientation,
      tone: isSunk(ship) ? ('wreck' as const) : ('fleet' as const),
    }));
}

/** The most recent shot animates once, on whichever board received it. */
function animationFor(last: LogEntry | undefined, attacker: Player, at: Coord): CellAnimation {
  if (!last || last.player !== attacker || !sameCoord(last.at, at)) return null;
  if (last.sunkShipId) return 'sunk';
  return last.outcome === 'hit' ? 'hit' : 'miss';
}

/** Shown beside a board only once it means something: no zeroes on an untouched fleet. */
function sunkCaption(board: BoardModel): string | undefined {
  const sunk = board.ships.filter(isSunk).length;
  return sunk === 0 ? undefined : `${sunk} of ${FLEET.length} sunk`;
}

export function GameScreen({ game }: { readonly game: Game }) {
  const { state, aiThinking } = game;
  // Tagged with the log length it happened at, so the notice disappears once a shot lands.
  const [rejected, setRejected] = useState<{
    readonly reason: IllegalReason;
    readonly afterShots: number;
  } | null>(null);

  const enemyBoard = state.boards.ai;
  const ownBoard = state.boards.human;
  const playable = state.phase === 'playing' && !aiThinking;
  const last = state.log.at(-1);
  const rejection = rejected?.afterShots === state.log.length ? rejected.reason : null;

  // Only cells of ships the engine reports as sunk may be revealed on the enemy board.
  const sunkEnemyCells = new Set(
    enemyBoard.ships.filter(isSunk).flatMap((ship) => ship.cells.map((cell) => coordKey(cell))),
  );

  const enemyVariant = (at: Coord): CellVariant => {
    const shot = shotAt(enemyBoard, at);
    if (shot === 'miss') return 'miss';
    if (shot === 'hit') return sunkEnemyCells.has(coordKey(at)) ? 'sunk' : 'hit';
    return 'water';
  };

  const ownVariant = (at: Coord): CellVariant => {
    const shot = shotAt(ownBoard, at);
    const ship = shipAt(ownBoard, at);
    if (shot === 'miss') return 'miss';
    if (shot === 'hit') return ship !== undefined && isSunk(ship) ? 'sunk' : 'hit';
    return ship ? 'ship' : 'water';
  };

  const enemyCaption = sunkCaption(enemyBoard);
  const ownCaption = sunkCaption(ownBoard);

  // One line of commentary: a rejected shot, otherwise whatever just landed.
  const status = rejection
    ? { tone: 'invalid' as const, text: reasonText(rejection), key: `reject-${state.log.length}` }
    : last
      ? { tone: 'neutral' as const, text: describeShot(last), key: last.seq }
      : { tone: 'neutral' as const, text: 'Battle stations — pick a target', key: 'start' };

  return (
    <div className="mx-auto flex w-full max-w-[74rem] flex-col gap-8 sm:gap-10">
      <LiveRegion message={battleAnnouncement(state, aiThinking)} />

      <AppHeader>
        <div className="flex items-center gap-4 sm:gap-6">
          <TurnBanner state={state} aiThinking={aiThinking} />
          <button
            type="button"
            onClick={() => game.reset()}
            className="glass-button min-h-11 rounded-full px-4 text-sm"
          >
            New game
          </button>
        </div>
      </AppHeader>

      <div className="grid gap-10 lg:grid-cols-2 lg:gap-14">
        {/* Attack board first: it is where the player acts. */}
        <Board
          label="Enemy waters"
          {...(enemyCaption === undefined ? {} : { caption: enemyCaption })}
          side="enemy"
          variantAt={enemyVariant}
          // Only sunk enemy hulls are drawn; an unhit ship is indistinguishable from open water.
          ships={visibleShips(enemyBoard, 'sunkOnly')}
          animationAt={(at) => animationFor(last, 'human', at)}
          onSelect={(at) => {
            const reason = game.fire(at);
            setRejected(reason === null ? null : { reason, afterShots: state.log.length });
          }}
          cellDisabled={(at) => shotAt(enemyBoard, at) !== 'unknown'}
          disabled={!playable}
          // Entering the battle (and returning from a finished game) puts focus on the grid.
          focusKey={game.generation}
        />

        <Board
          label="Your waters"
          {...(ownCaption === undefined ? {} : { caption: ownCaption })}
          side="friendly"
          variantAt={ownVariant}
          ships={visibleShips(ownBoard, 'all')}
          animationAt={(at) => animationFor(last, 'ai', at)}
        />
      </div>

      <StatusLine tone={status.tone} eventKey={status.key}>
        {status.text}
      </StatusLine>
      <p className="sr-only">Keyboard: arrow keys move across the grid, Enter fires.</p>

      {state.phase === 'gameOver' ? (
        <GameOverOverlay state={state} onPlayAgain={() => game.reset()} />
      ) : null}
    </div>
  );
}
