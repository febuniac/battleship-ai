export interface ValidationHintProps {
  readonly tone: 'neutral' | 'valid' | 'invalid';
  readonly children: string;
}

const TONE_CLASS: Readonly<Record<ValidationHintProps['tone'], string>> = {
  neutral: 'border-slate-700 bg-slate-800/60 text-slate-300',
  valid: 'border-emerald-500/60 bg-emerald-500/10 text-emerald-200',
  invalid: 'border-rose-500/60 bg-rose-500/10 text-rose-200',
};

export function ValidationHint({ tone, children }: ValidationHintProps) {
  return (
    <p
      role="status"
      aria-live="polite"
      className={`rounded border px-3 py-2 text-sm ${TONE_CLASS[tone]}`}
    >
      {children}
    </p>
  );
}
