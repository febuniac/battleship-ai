import type { AppOptions } from './App.tsx';

/**
 * Optional URL overrides, the whole testing hook the E2E suite needs: `?seed=` makes a game
 * reproducible, `?aiDelay=` removes the deliberate pacing so tests wait on state instead of on the
 * clock, and `?idlePrompt=` shortens the idle-turn wait to something a test can sit through. None
 * is surfaced in the UI, and omitting them gives normal play.
 */
export function optionsFromUrl(search: string): AppOptions {
  const params = new URLSearchParams(search);
  const seed = nonNegativeInt(params.get('seed'));
  const aiDelayMs = nonNegativeInt(params.get('aiDelay'));
  const idlePromptMs = nonNegativeInt(params.get('idlePrompt'));

  return {
    ...(seed === null ? {} : { seed }),
    ...(aiDelayMs === null ? {} : { aiDelayMs }),
    ...(idlePromptMs === null ? {} : { idlePromptMs }),
  };
}

function nonNegativeInt(raw: string | null): number | null {
  if (raw === null || !/^\d+$/.test(raw)) return null;
  const value = Number(raw);
  return Number.isSafeInteger(value) ? value : null;
}
