import { useEffect, useRef } from 'react';
import { isSunk } from '../../engine/board.ts';
import { FLEET } from '../../engine/rules.ts';
import type { GameState } from '../../engine/types.ts';

export interface GameOverOverlayProps {
  readonly state: GameState;
  readonly onPlayAgain: () => void;
}

function accuracy(shots: number, hits: number): string {
  return shots === 0 ? '—' : `${Math.round((hits / shots) * 100)}%`;
}

export function GameOverOverlay({ state, onPlayAgain }: GameOverOverlayProps) {
  const humanWon = state.winner === 'human';
  const { human, ai } = state.stats;
  const playAgainRef = useRef<HTMLButtonElement>(null);

  // The board behind the dialog is no longer actionable, so focus moves to the only next step.
  useEffect(() => {
    playAgainRef.current?.focus();
  }, []);

  const rows: readonly { readonly label: string; readonly you: string; readonly ai: string }[] = [
    { label: 'Shots', you: `${human.shots}`, ai: `${ai.shots}` },
    { label: 'Hits', you: `${human.hits}`, ai: `${ai.hits}` },
    { label: 'Accuracy', you: accuracy(human.shots, human.hits), ai: accuracy(ai.shots, ai.hits) },
    {
      label: 'Ships sunk',
      you: `${state.boards.ai.ships.filter(isSunk).length}/${FLEET.length}`,
      ai: `${state.boards.human.ships.filter(isSunk).length}/${FLEET.length}`,
    },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Game over"
      className="animate-fade-in fixed inset-0 z-10 flex items-center justify-center bg-sea-950/85 p-4 backdrop-blur-sm"
    >
      <div className="animate-reveal flex w-full max-w-sm flex-col gap-5 rounded-lg border border-sea-700 bg-sea-900 p-6 shadow-2xl">
        <div className="flex flex-col gap-1">
          <p
            className={`text-xs font-semibold tracking-[0.16em] uppercase ${
              humanWon ? 'text-emerald-300' : 'text-rose-300'
            }`}
          >
            {humanWon ? 'Victory' : 'Defeat'}
          </p>
          <h2 className="text-2xl font-semibold text-slate-50">
            {humanWon ? 'You win' : 'The AI wins'}
          </h2>
          <p className="text-sm text-slate-400">
            {humanWon ? 'Every enemy ship is on the seabed.' : 'Your fleet has been sunk.'}
          </p>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs tracking-[0.08em] text-slate-500 uppercase">
              <th scope="col" className="text-left font-medium">
                Final stats
              </th>
              <th scope="col" className="text-right font-medium">
                You
              </th>
              <th scope="col" className="text-right font-medium">
                AI
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-t border-sea-800">
                <th scope="row" className="py-1.5 text-left font-normal text-slate-400">
                  {row.label}
                </th>
                <td className="py-1.5 text-right tabular-nums text-slate-100">{row.you}</td>
                <td className="py-1.5 text-right tabular-nums text-slate-100">{row.ai}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <button
          ref={playAgainRef}
          type="button"
          onClick={onPlayAgain}
          className="min-h-11 rounded-md bg-sky-500 px-4 font-medium text-sea-950 transition-colors hover:bg-sky-400"
        >
          Play again
        </button>
      </div>
    </div>
  );
}
