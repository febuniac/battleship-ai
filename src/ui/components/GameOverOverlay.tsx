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
      /* The finished boards stay visible through the glass: the result is read against them. */
      className="animate-fade-in fixed inset-0 z-10 flex items-center justify-center bg-paper/45 p-4 backdrop-blur-[3px]"
    >
      <div className="glass animate-reveal flex w-full max-w-sm flex-col gap-6 rounded-3xl p-7">
        <div className="flex flex-col gap-1">
          <p
            className={`text-[0.7rem] font-medium tracking-[0.2em] uppercase ${
              humanWon ? 'text-signal' : 'text-impact'
            }`}
          >
            {humanWon ? 'Victory' : 'Defeat'}
          </p>
          <h2 className="text-2xl font-light tracking-tight text-ink">
            {humanWon ? 'You win' : 'The AI wins'}
          </h2>
          <p className="text-sm text-ink-soft">
            {humanWon ? 'Every enemy ship is on the seabed.' : 'Your fleet has been sunk.'}
          </p>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="text-[0.65rem] tracking-[0.12em] text-ink-faint uppercase">
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
              <tr key={row.label} className="border-t border-ink/8">
                <th scope="row" className="py-1.5 text-left font-normal text-ink-soft">
                  {row.label}
                </th>
                <td className="py-1.5 text-right text-ink tabular-nums">{row.you}</td>
                <td className="py-1.5 text-right text-ink tabular-nums">{row.ai}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <button
          ref={playAgainRef}
          type="button"
          onClick={onPlayAgain}
          className="min-h-11 rounded-full bg-ink px-4 text-sm font-medium text-paper transition-colors hover:bg-ink/90"
        >
          Play again
        </button>
      </div>
    </div>
  );
}
