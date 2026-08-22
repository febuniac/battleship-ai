import { useEffect, useRef } from 'react';
import { FLEET } from '../../engine/rules.ts';

const STEPS: readonly { readonly title: string; readonly body: string }[] = [
  { title: 'Place your fleet', body: `Position your ${FLEET.length} ships on the board.` },
  {
    title: 'Take turns',
    body: 'Fire at one cell at a time. A hit lets you fire again. A miss passes the turn.',
  },
  { title: 'Sink the fleet', body: `Sink all ${FLEET.length} enemy ships to win.` },
];

/**
 * The rules, read straight off the engine's fleet spec so they can't drift from the game.
 * A small glass dialog over the opening screen: Escape or the backdrop closes it, focus is
 * trapped while it is open and returned to the trigger on close.
 */
export function RulesDialog({ onClose }: { readonly onClose: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>('button');
      if (!focusable || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (first === undefined || last === undefined) return;
      // Keep Tab inside the dialog, as a modal must.
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);

  return (
    <div
      className="animate-fade-in fixed inset-0 z-10 flex items-center justify-center bg-paper/45 p-4 backdrop-blur-[3px]"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="rules-title"
        /* The backdrop closes the dialog; clicks on the panel itself must not bubble to it. */
        onClick={(event) => {
          event.stopPropagation();
        }}
        className="glass animate-reveal flex w-full max-w-sm flex-col gap-6 rounded-3xl p-7 text-left"
      >
        <div className="flex items-start justify-between gap-4">
          <h2
            id="rules-title"
            className="text-[0.7rem] font-medium tracking-[0.24em] text-ink uppercase"
          >
            The rules
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close the rules"
            className="-mt-2 -mr-2 flex size-9 items-center justify-center rounded-full text-lg leading-none text-ink-faint transition-colors hover:bg-ink/6 hover:text-ink"
          >
            <span aria-hidden>×</span>
          </button>
        </div>

        <ol className="flex flex-col gap-4">
          {STEPS.map(({ title, body }, index) => (
            <li key={title} className="flex gap-3">
              <span className="text-xs leading-6 text-ink-faint tabular-nums">{index + 1}</span>
              <div className="flex flex-col gap-0.5">
                <h3 className="text-sm font-medium text-ink">{title}</h3>
                <p className="text-sm leading-relaxed text-ink-soft">{body}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="flex flex-col gap-2 border-t border-ink/8 pt-5">
          <h3 className="text-[0.65rem] font-medium tracking-[0.18em] text-ink-faint uppercase">
            Fleet
          </h3>
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-soft">
            {FLEET.map((ship) => (
              <li key={ship.id}>
                {ship.name} <span className="text-ink-faint">·</span>{' '}
                <span className="text-ink tabular-nums">{ship.size}</span>
              </li>
            ))}
          </ul>
          <p className="pt-1 text-xs text-ink-faint">Ships may touch.</p>
        </div>
      </div>
    </div>
  );
}
