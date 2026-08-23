import type { UseGameOptions } from './useGame.ts';

/**
 * Optional URL overrides, the whole testing hook the E2E suite needs: `?seed=` makes a game
 * reproducible and `?aiDelay=` removes the deliberate pacing so tests wait on state instead of
 * on the clock. Neither is surfaced in the UI, and omitting them gives normal play.
 */
export function optionsFromUrl(search: string): UseGameOptions {
  const params = new URLSearchParams(search);
  const seed = nonNegativeInt(params.get('seed'));
  const aiDelayMs = nonNegativeInt(params.get('aiDelay'));

  return {
    ...(seed === null ? {} : { seed }),
    ...(aiDelayMs === null ? {} : { aiDelayMs }),
  };
}

function nonNegativeInt(raw: string | null): number | null {
  if (raw === null || !/^\d+$/.test(raw)) return null;
  const value = Number(raw);
  return Number.isSafeInteger(value) ? value : null;
}
