import type { GameState } from '../../engine/types.ts';

export interface TurnBannerProps {
  readonly state: GameState;
  readonly aiThinking: boolean;
}

export function TurnBanner({ state, aiThinking }: TurnBannerProps) {
  const text =
    state.phase === 'gameOver'
      ? state.winner === 'human'
        ? 'You win - the enemy fleet is sunk'
        : 'The AI wins - your fleet is sunk'
      : aiThinking
        ? 'AI is thinking...'
        : 'Your turn - fire at the enemy waters';

  const tone =
    state.phase === 'gameOver'
      ? 'border-slate-600 bg-slate-800'
      : aiThinking
        ? 'border-rose-500/60 bg-rose-500/10'
        : 'border-sky-500/60 bg-sky-500/10';

  return (
    <p
      role="status"
      aria-live="polite"
      className={`rounded border px-4 py-2 text-center text-sm font-medium text-slate-100 ${tone}`}
    >
      {text}
    </p>
  );
}
