export interface ValidationHintProps {
  readonly tone: 'neutral' | 'valid' | 'invalid';
  readonly children: string;
}

const TONE_CLASS: Readonly<Record<ValidationHintProps['tone'], string>> = {
  neutral: 'border-sea-700 bg-sea-800/60 text-slate-300',
  valid: 'border-emerald-500/60 bg-emerald-500/10 text-emerald-200',
  invalid: 'border-rose-500/60 bg-rose-500/10 text-rose-200',
};

const TONE_ICON: Readonly<Record<ValidationHintProps['tone'], string>> = {
  neutral: '·',
  valid: '✓',
  invalid: '✕',
};

/** Visible-only feedback; the spoken version goes through the app's single live region. */
export function ValidationHint({ tone, children }: ValidationHintProps) {
  return (
    <p
      data-testid="validation-hint"
      data-tone={tone}
      className={`flex min-h-11 items-center gap-2 rounded-md border px-3 py-2 text-sm ${TONE_CLASS[tone]}`}
    >
      <span aria-hidden className="font-semibold">
        {TONE_ICON[tone]}
      </span>
      {children}
    </p>
  );
}
