/**
 * Seeded PRNG (mulberry32). Two flavours over the same algorithm:
 *
 * - pure step functions, so `GameState` can carry the generator state immutably;
 * - a small stateful `Rng` wrapper, which is what callers such as the AI use.
 *
 * `Math.random` is never used anywhere in the engine or the AI: every random
 * decision is reproducible from a seed, which is what makes the AI benchmarks
 * and the self-play invariant tests possible.
 */

/** Opaque generator state. Always advance it through the functions below. */
export type RngState = number;

export function seedRng(seed: number): RngState {
  // Any 32-bit value is a valid state; normalise so callers can pass anything.
  return seed >>> 0;
}

function step(state: RngState): readonly [number, RngState] {
  const next = (state + 0x6d2b79f5) >>> 0;
  let z = next;
  z = Math.imul(z ^ (z >>> 15), z | 1);
  z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
  const value = ((z ^ (z >>> 14)) >>> 0) / 4294967296;
  return [value, next];
}

/** Uniform float in `[0, 1)`. */
export function nextFloat(state: RngState): readonly [number, RngState] {
  return step(state);
}

/** Uniform integer in `[0, maxExclusive)`. */
export function nextInt(state: RngState, maxExclusive: number): readonly [number, RngState] {
  if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
    throw new Error(`maxExclusive must be a positive integer, got ${maxExclusive}`);
  }
  const [value, nextState] = step(state);
  return [Math.floor(value * maxExclusive), nextState];
}

export interface Rng {
  float(): number;
  int(maxExclusive: number): number;
  pick<T>(items: readonly T[]): T;
  /** Current state, so a run can be resumed or reproduced. */
  state(): RngState;
}

export function createRng(seed: number): Rng {
  let state = seedRng(seed);
  return {
    float() {
      const [value, nextState] = nextFloat(state);
      state = nextState;
      return value;
    },
    int(maxExclusive) {
      const [value, nextState] = nextInt(state, maxExclusive);
      state = nextState;
      return value;
    },
    pick(items) {
      if (items.length === 0) throw new Error('Cannot pick from an empty list');
      const [index, nextState] = nextInt(state, items.length);
      state = nextState;
      return items[index] as (typeof items)[number];
    },
    state() {
      return state;
    },
  };
}
