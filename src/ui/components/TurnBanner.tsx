import type { GameState } from '../../engine/types.ts';

export interface TurnBannerProps {
  readonly state: GameState;
  readonly aiThinking: boolean;
}

/**
 * Visible turn indicator. Deliberately *not* a live region: announcements go through the app's
 * single `LiveRegion` so a turn change is spoken once, with its cause.
 */
export function TurnBanner({ state, aiThinking }: TurnBannerProps) {
  const over = state.phase === 'gameOver';

  const text = over
    ? state.winner === 'human'
      ? 'You win — the enemy fleet is sunk'
      : 'The AI wins — your fleet is sunk'
    : aiThinking
      ? 'AI is thinking'
      : 'Your turn — fire at the enemy waters';

  const tone = over
    ? 'border-sea-600 bg-sea-800'
    : aiThinking
      ? 'border-rose-500/60 bg-rose-500/10'
      : 'border-sky-500/60 bg-sky-500/10';

  return (
    <p
      // Remounting on each phase/turn change replays the transition animation.
      key={`${state.phase}-${aiThinking ? 'ai' : 'human'}`}
      data-testid="turn-banner"
      className={`animate-turn-change flex items-center justify-center gap-2 rounded-md border px-4 py-2.5 text-center text-sm font-medium text-slate-100 ${tone}`}
    >
      {!over && aiThinking ? (
        <span aria-hidden className="flex gap-1">
          {[0, 1, 2].map((index) => (
            <span
              key={index}
              className="animate-thinking-pulse h-1.5 w-1.5 rounded-full bg-rose-300"
              style={{ animationDelay: `${index * 160}ms` }}
            />
          ))}
        </span>
      ) : null}
      {text}
    </p>
  );
}
