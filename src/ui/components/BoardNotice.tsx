/** How a notice reads: news about damage, or a nudge to act. */
const TONE_CLASS = {
  impact: 'text-impact',
  neutral: 'text-ink',
} as const;

export interface BoardNoticeProps {
  readonly children: string;
  readonly tone: keyof typeof TONE_CLASS;
  /** Whether the notice takes itself off screen, rather than waiting to be unmounted. */
  readonly transient?: boolean;
  readonly testId: string;
}

/**
 * A short line of news drawn on the water it belongs to. It never takes pointer events and has no
 * dismiss control: the board underneath stays fully playable while it is up, and it leaves either
 * on its own animation or as soon as the state it reported is no longer current.
 */
export function BoardNotice({ children, tone, transient = false, testId }: BoardNoticeProps) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center px-3"
    >
      <p
        data-testid={testId}
        className={`board-notice ${transient ? 'animate-notice' : 'animate-fade-in'} rounded-full px-3.5 py-1.5 text-center text-[0.72rem] font-semibold tracking-[0.14em] uppercase sm:text-xs ${TONE_CLASS[tone]}`}
      >
        {children}
      </p>
    </div>
  );
}
