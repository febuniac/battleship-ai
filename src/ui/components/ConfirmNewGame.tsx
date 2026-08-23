import { Modal } from './Modal.tsx';

export interface ConfirmNewGameProps {
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
}

/**
 * Guards the one control that can throw a game away. Opening it touches no game state; only
 * `onConfirm` resets. Focus lands on Cancel, so a stray Enter keeps the game.
 */
export function ConfirmNewGame({ onCancel, onConfirm }: ConfirmNewGameProps) {
  return (
    <Modal label="Start a new game?" onClose={onCancel}>
      <div className="flex flex-col gap-1.5">
        <h2 className="text-lg font-light tracking-tight text-ink">Start a new game?</h2>
        <p className="text-sm leading-relaxed text-ink-soft">Your current game will be lost.</p>
      </div>

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="glass-button min-h-11 rounded-full px-5 text-sm"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="min-h-11 rounded-full bg-impact px-5 text-sm font-medium text-paper transition-colors hover:bg-impact/90"
        >
          New game
        </button>
      </div>
    </Modal>
  );
}
