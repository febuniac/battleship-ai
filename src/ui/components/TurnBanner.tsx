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
      ? "AI's turn"
      : 'Your turn';

  return (
    <p
      // Remounting on each phase/turn change replays the transition animation.
      key={`${state.phase}-${aiThinking ? 'ai' : 'human'}`}
      data-testid="turn-banner"
      className="animate-turn-change flex items-baseline gap-2 text-sm text-ink"
    >
      <span
        aria-hidden
        className={`relative top-[-0.15rem] h-1.5 w-1.5 shrink-0 rounded-full ${
          over ? 'bg-ink-faint' : aiThinking ? 'animate-thinking-pulse bg-impact' : 'bg-signal'
        }`}
      />
      <span className="font-semibold tracking-[0.12em] uppercase">{text}</span>
      {/* Why the board is not answering yet. Secondary to the turn itself. */}
      {aiThinking ? <span className="text-xs text-ink-faint">AI is thinking…</span> : null}
    </p>
  );
}
