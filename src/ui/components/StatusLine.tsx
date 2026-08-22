export interface StatusLineProps {
  readonly tone: 'neutral' | 'valid' | 'impact' | 'invalid';
  readonly children: string;
  /** Changing this replays the entry animation, so a repeated message still registers. */
  readonly eventKey?: string | number;
}

const TONE_CLASS: Readonly<Record<StatusLineProps['tone'], string>> = {
  neutral: 'text-ink-soft',
  valid: 'text-ink',
  impact: 'text-impact',
  invalid: 'text-impact',
};

const TONE_DOT: Readonly<Record<StatusLineProps['tone'], string>> = {
  neutral: 'bg-ink-faint',
  valid: 'bg-signal',
  impact: 'bg-impact',
  invalid: 'bg-impact',
};

/**
 * The single line of running commentary: what just happened, or why a placement will not work.
 * It replaces the permanent log and stats panels — the board says everything else. Visible-only;
 * the spoken version goes through the app's live region.
 */
export function StatusLine({ tone, children, eventKey }: StatusLineProps) {
  return (
    <p
      key={eventKey}
      data-testid="status-line"
      data-tone={tone}
      className={`animate-fade-in flex min-h-6 items-center justify-center gap-2 text-center text-sm ${TONE_CLASS[tone]}`}
    >
      <span aria-hidden className={`h-1 w-1 shrink-0 rounded-full ${TONE_DOT[tone]}`} />
      {children}
    </p>
  );
}
