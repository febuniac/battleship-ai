import { useCallback, useEffect, useState } from 'react';

/**
 * How long the player's own turn may sit untouched before the board says so. Long enough that it
 * never interrupts someone who is thinking, short enough to catch a player who did not notice the
 * turn came back to them after a hit.
 */
export const IDLE_PROMPT_MS = 30_000;

export interface IdlePrompt {
  /** Whether the turn has been idle long enough to be worth pointing out. */
  readonly prompt: boolean;
  /** Called when the player touches the board: the prompt has been read, so it goes away. */
  readonly noteActivity: () => void;
}

/**
 * A timer that only runs while it is the player's turn to act. `turnKey` is whatever identifies
 * the current turn — the shot count and whose turn it is — so every action or turn change
 * restarts the wait, and `noteActivity` dismisses a prompt the player has already seen.
 *
 * The elapsed timer records *which* wait it belongs to rather than flipping a flag, so a stale
 * timeout can never light the prompt for a turn that has since moved on.
 */
export function useIdlePrompt(
  active: boolean,
  turnKey: string,
  delayMs: number = IDLE_PROMPT_MS,
): IdlePrompt {
  const [activity, setActivity] = useState(0);
  const [elapsedFor, setElapsedFor] = useState<string | null>(null);
  const waitKey = `${turnKey}#${activity}`;

  useEffect(() => {
    if (!active) return;
    const timer = setTimeout(() => {
      setElapsedFor(waitKey);
    }, delayMs);
    return () => {
      clearTimeout(timer);
    };
  }, [active, waitKey, delayMs]);

  const noteActivity = useCallback(() => {
    setActivity((count) => count + 1);
  }, []);

  return { prompt: active && elapsedFor === waitKey, noteActivity };
}
