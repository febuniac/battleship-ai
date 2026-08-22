import type { GameState } from '../../engine/types.ts';

export interface TurnBannerProps {
  readonly state: GameState;
  readonly aiThinking: boolean;
}

/**
 * Whose turn it is, as a line of type rather than a panel. Deliberately *not* a live region:
 * announcements go through the app's single `LiveRegion` so a turn change is spoken once, with
 * its cause.
 */
export function TurnBanner({ state, aiThinking }: TurnBannerProps) {
  const over = state.phase === 'gameOver';

  const text = over
    ? state.winner === 'human'
      ? 'You win'
      : 'The AI wins'
    : aiThinking
      ? 'AI is thinking'
      : 'Your turn';

  return (
    <p
      // Remounting on each phase/turn change replays the transition animation.
      key={`${state.phase}-${aiThinking ? 'ai' : 'human'}`}
      data-testid="turn-banner"
      className="animate-turn-change flex items-center gap-2 text-sm font-medium text-ink"
    >
      <span
        aria-hidden
        className={`h-1.5 w-1.5 rounded-full ${
          over ? 'bg-ink-faint' : aiThinking ? 'animate-thinking-pulse bg-impact' : 'bg-signal'
        }`}
      />
      {text}
    </p>
  );
}
