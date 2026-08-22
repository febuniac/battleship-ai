import { describe, expect, it } from 'vitest';
import { createRng, nextFloat, nextInt, seedRng } from './rng.ts';

describe('seeded rng', () => {
  it('produces the same stream for the same seed', () => {
    const draw = (seed: number) => {
      const rng = createRng(seed);
      return Array.from({ length: 20 }, () => rng.int(100));
    };
    expect(draw(42)).toEqual(draw(42));
    expect(draw(42)).not.toEqual(draw(43));
  });

  it('keeps floats in [0, 1)', () => {
    const rng = createRng(7);
    for (let i = 0; i < 1000; i += 1) {
      const value = rng.float();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('keeps integers in range and reaches every bucket', () => {
    const rng = createRng(9);
    const seen = new Set<number>();
    for (let i = 0; i < 1000; i += 1) {
      const value = rng.int(10);
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(10);
      seen.add(value);
    }
    expect(seen.size).toBe(10);
  });

  it('rejects a non-positive range', () => {
    expect(() => createRng(1).int(0)).toThrow();
    expect(() => nextInt(seedRng(1), -3)).toThrow();
    expect(() => nextInt(seedRng(1), 1.5)).toThrow();
  });

  it('picks from a list and rejects an empty one', () => {
    const rng = createRng(3);
    expect(['a', 'b', 'c']).toContain(rng.pick(['a', 'b', 'c']));
    expect(() => rng.pick([])).toThrow();
  });

  it('advances state purely, leaving the caller state untouched', () => {
    const state = seedRng(123);
    const [firstValue, nextState] = nextFloat(state);
    const [sameValue] = nextFloat(state);
    expect(sameValue).toBe(firstValue);
    expect(nextState).not.toBe(state);
  });

  it('exposes its state so a run can be resumed mid-stream', () => {
    const rng = createRng(5);
    rng.int(50);
    const resumed = createRng(rng.state());
    const continued = [rng.int(50), rng.int(50)];
    expect([resumed.int(50), resumed.int(50)]).toEqual(continued);
  });
});
