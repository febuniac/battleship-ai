import { useEffect, useRef, type ReactNode } from 'react';

export interface ModalProps {
  readonly label: string;
  readonly onClose: () => void;
  readonly children: ReactNode;
}

/**
 * The shared glass dialog: a labelled modal over a blurred backdrop, focus moved inside and
 * trapped while open, Escape and backdrop click closing it. Callers decide what focus returns to.
 */
export function Modal({ label, onClose, children }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    panelRef.current?.querySelector<HTMLElement>('button')?.focus();
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = panelRef.current?.querySelectorAll<HTMLElement>('button');
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
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        /* The backdrop closes the dialog; clicks on the panel itself must not bubble to it. */
        onClick={(event) => {
          event.stopPropagation();
        }}
        className="glass animate-reveal flex w-full max-w-sm flex-col gap-6 rounded-3xl p-7 text-left"
      >
        {children}
      </div>
    </div>
  );
}
