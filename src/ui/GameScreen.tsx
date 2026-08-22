import { useState } from 'react';
import { coordKey, isSunk, shipAt, shotAt } from '../engine/board.ts';
import type { Coord, IllegalReason } from '../engine/types.ts';
import { Board } from './components/Board.tsx';
import type { CellVariant } from './components/Cell.tsx';
import { FleetStatus } from './components/FleetStatus.tsx';
import { GameOverOverlay } from './components/GameOverOverlay.tsx';
import { StatusLog } from './components/StatusLog.tsx';
import { TurnBanner } from './components/TurnBanner.tsx';
import { ValidationHint } from './components/ValidationHint.tsx';
import { reasonText } from './messages.ts';
import type { Game } from './useGame.ts';

export function GameScreen({ game }: { readonly game: Game }) {
  const { state, aiThinking } = game;
  const [rejected, setRejected] = useState<IllegalReason | null>(null);

  const enemyBoard = state.boards.ai;
  const ownBoard = state.boards.human;
  const playable = state.phase === 'playing' && !aiThinking;

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
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-slate-50">Battleship</h1>
        <button
          type="button"
          onClick={() => {
            game.reset();
            setRejected(null);
          }}
          className="rounded border border-slate-600 px-3 py-1.5 text-sm text-slate-200 hover:border-slate-400 hover:bg-slate-800"
        >
          New game
        </button>
      </header>

      <TurnBanner state={state} aiThinking={aiThinking} />

      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="flex flex-col gap-3 lg:flex-1">
          <Board
            label="Enemy waters"
            caption={playable ? 'Click a cell to fire' : 'Locked while the AI plays'}
            variantAt={enemyVariant}
            onSelect={(at) => {
              setRejected(game.fire(at));
            }}
            cellDisabled={(at) => shotAt(enemyBoard, at) !== 'unknown'}
            disabled={!playable}
          />
          <FleetStatus label="Enemy fleet" board={enemyBoard} revealAfloat={false} />
        </div>

        <div className="flex flex-col gap-3 lg:flex-1">
          <Board label="Your waters" caption="AI shots land here" variantAt={ownVariant} />
          <FleetStatus label="Your fleet" board={ownBoard} revealAfloat />
        </div>

        <aside className="flex flex-col gap-4 lg:w-64">
          {rejected ? <ValidationHint tone="invalid">{reasonText(rejected)}</ValidationHint> : null}
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
            <dt className="text-slate-400">Your shots</dt>
            <dd className="text-slate-100">
              {state.stats.human.shots} ({state.stats.human.hits} hits)
            </dd>
            <dt className="text-slate-400">AI shots</dt>
            <dd className="text-slate-100">
              {state.stats.ai.shots} ({state.stats.ai.hits} hits)
            </dd>
          </dl>
          <StatusLog entries={state.log} />
        </aside>
      </div>

      {state.phase === 'gameOver' ? (
        <GameOverOverlay
          state={state}
          onPlayAgain={() => {
            game.reset();
            setRejected(null);
          }}
        />
      ) : null}
    </div>
  );
}
