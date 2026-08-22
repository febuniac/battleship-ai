import { useState } from 'react';
import { coordKey, isSunk, sameCoord, shipAt, shotAt } from '../engine/board.ts';
import type {
  Board as BoardModel,
  Coord,
  IllegalReason,
  LogEntry,
  Player,
} from '../engine/types.ts';
import { battleAnnouncement } from './announcements.ts';
import { Board } from './components/Board.tsx';
import type { CellAnimation, CellVariant } from './components/Cell.tsx';
import { FleetStatus } from './components/FleetStatus.tsx';
import { GameOverOverlay } from './components/GameOverOverlay.tsx';
import { Legend } from './components/Legend.tsx';
import { LiveRegion } from './components/LiveRegion.tsx';
import type { ShipVisual } from './components/ShipLayer.tsx';
import { StatusLog } from './components/StatusLog.tsx';
import { TurnBanner } from './components/TurnBanner.tsx';
import { ValidationHint } from './components/ValidationHint.tsx';
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

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
      <LiveRegion message={battleAnnouncement(state, aiThinking)} />

      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight text-slate-50 sm:text-2xl">
          Battleship
        </h1>
        <button
          type="button"
          onClick={() => game.reset()}
          className="min-h-11 rounded-md border border-sea-600 px-3 text-sm text-slate-200 transition-colors hover:border-slate-400 hover:bg-sea-800"
        >
          New game
        </button>
      </header>

      <TurnBanner state={state} aiThinking={aiThinking} />

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr_16rem] lg:gap-8">
        {/* Attack board first: it is where the player acts. */}
        <div className="flex flex-col gap-3">
          <Board
            label="Enemy waters"
            caption={
              state.phase === 'gameOver'
                ? 'Game over'
                : playable
                  ? 'Click a cell to fire'
                  : 'Locked while the AI plays'
            }
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
          <FleetStatus label="Enemy fleet" board={enemyBoard} revealAfloat={false} />
        </div>

        <div className="flex flex-col gap-3">
          <Board
            label="Your waters"
            caption="AI shots land here"
            side="friendly"
            variantAt={ownVariant}
            ships={visibleShips(ownBoard, 'all')}
            animationAt={(at) => animationFor(last, 'ai', at)}
          />
          <FleetStatus label="Your fleet" board={ownBoard} revealAfloat />
        </div>

        <aside className="flex flex-col gap-4">
          {rejection ? (
            <ValidationHint tone="invalid">{reasonText(rejection)}</ValidationHint>
          ) : null}

          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
            <dt className="text-slate-400">Your shots</dt>
            <dd className="tabular-nums text-slate-100">
              {state.stats.human.shots} ({state.stats.human.hits} hits)
            </dd>
            <dt className="text-slate-400">AI shots</dt>
            <dd className="tabular-nums text-slate-100">
              {state.stats.ai.shots} ({state.stats.ai.hits} hits)
            </dd>
          </dl>

          <Legend />
          <StatusLog entries={state.log} />
          <p className="text-xs text-slate-500">Keyboard: arrow keys move, Enter fires.</p>
        </aside>
      </div>

      {state.phase === 'gameOver' ? (
        <GameOverOverlay state={state} onPlayAgain={() => game.reset()} />
      ) : null}
    </div>
  );
}
