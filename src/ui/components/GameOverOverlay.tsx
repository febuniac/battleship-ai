import { FLEET } from '../../engine/rules.ts';
import { isSunk } from '../../engine/board.ts';
import type { GameState } from '../../engine/types.ts';

export interface GameOverOverlayProps {
  readonly state: GameState;
  readonly onPlayAgain: () => void;
}

function accuracy(shots: number, hits: number): string {
  return shots === 0 ? '-' : `${Math.round((hits / shots) * 100)}%`;
}

export function GameOverOverlay({ state, onPlayAgain }: GameOverOverlayProps) {
  const humanWon = state.winner === 'human';
  const { human, ai } = state.stats;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Game over"
      className="fixed inset-0 z-10 flex items-center justify-center bg-slate-950/80 p-4"
    >
      <div className="flex w-full max-w-md flex-col gap-4 rounded-lg border border-slate-700 bg-slate-900 p-6">
        <h2 className="text-xl font-semibold text-slate-50">
          {humanWon ? 'You win' : 'The AI wins'}
        </h2>
        <p className="text-sm text-slate-400">
          {humanWon ? 'Every enemy ship is on the seabed.' : 'Your fleet has been sunk. Rematch?'}
        </p>

        <dl className="grid grid-cols-3 gap-y-1 text-sm">
          <dt className="col-span-1 text-slate-400">Shots</dt>
          <dd className="text-slate-100">You {human.shots}</dd>
          <dd className="text-slate-100">AI {ai.shots}</dd>

          <dt className="col-span-1 text-slate-400">Hits</dt>
          <dd className="text-slate-100">You {human.hits}</dd>
          <dd className="text-slate-100">AI {ai.hits}</dd>

          <dt className="col-span-1 text-slate-400">Accuracy</dt>
          <dd className="text-slate-100">You {accuracy(human.shots, human.hits)}</dd>
          <dd className="text-slate-100">AI {accuracy(ai.shots, ai.hits)}</dd>

          <dt className="col-span-1 text-slate-400">Ships sunk</dt>
          <dd className="text-slate-100">
            You {state.boards.ai.ships.filter(isSunk).length}/{FLEET.length}
          </dd>
          <dd className="text-slate-100">
            AI {state.boards.human.ships.filter(isSunk).length}/{FLEET.length}
          </dd>
        </dl>

        <button
          type="button"
          onClick={onPlayAgain}
          className="rounded bg-sky-500 px-4 py-2 font-medium text-slate-950 hover:bg-sky-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300"
        >
          Play again
        </button>
      </div>
    </div>
  );
}
