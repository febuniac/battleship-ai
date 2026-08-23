import { useEffect, useId, useRef } from 'react';

export interface BoardIntroProps {
  readonly title: string;
  readonly detail: string;
  readonly action: string;
  readonly onDismiss: () => void;
}

/**
 * The one-time invitation into a stage of the game: a sheet of glass over the water it explains,
 * with the board still legible behind it. It is shown once per stage and then gone for good, so it
 * introduces the game without ever standing between the player and a move.
 *
 * Scoped to the board rather than the page — `absolute` inside the water — so it never covers the
 * rest of the interface and never needs to be sized against the viewport.
 */
export function BoardIntro({ title, detail, action, onDismiss }: BoardIntroProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const detailId = useId();

  useEffect(() => {
    buttonRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key !== 'Escape') return;
      // Escape dismisses, as it does everywhere else in the game.
      onDismiss();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [onDismiss]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={detailId}
      data-testid="board-intro"
      className="animate-fade-in absolute inset-0 z-10 flex items-center justify-center p-4 backdrop-blur-[6px] sm:p-8"
    >
      <div className="board-intro animate-reveal flex w-full max-w-[22rem] flex-col items-center gap-5 rounded-2xl px-6 py-10 text-center sm:max-w-[26rem] sm:gap-7 sm:rounded-3xl sm:px-10 sm:py-14">
        <div className="flex flex-col items-center gap-2 sm:gap-3">
          <h3
            id={titleId}
            className="text-xl leading-tight font-light tracking-[0.14em] text-ink uppercase sm:text-3xl sm:tracking-[0.18em]"
          >
            {title}
          </h3>
          <p id={detailId} className="text-xs text-ink-soft sm:text-sm">
            {detail}
          </p>
        </div>
        <button
          ref={buttonRef}
          type="button"
          onClick={onDismiss}
          className="min-h-11 rounded-full bg-ink px-6 text-sm font-medium text-paper transition-colors hover:bg-ink/90"
        >
          {action}
        </button>
      </div>
    </div>
  );
}
