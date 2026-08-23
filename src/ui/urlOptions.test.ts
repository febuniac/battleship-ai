import { describe, expect, it } from 'vitest';
import { optionsFromUrl } from './urlOptions.ts';

describe('optionsFromUrl', () => {
  it('is empty without overrides, so normal play is unaffected', () => {
    expect(optionsFromUrl('')).toEqual({});
    expect(optionsFromUrl('?other=1')).toEqual({});
  });

  it('reads a seed and an AI delay', () => {
    expect(optionsFromUrl('?seed=42&aiDelay=0')).toEqual({ seed: 42, aiDelayMs: 0 });
  });

  it('ignores values that are not usable', () => {
    expect(optionsFromUrl('?seed=abc&aiDelay=-5')).toEqual({});
    expect(optionsFromUrl('?seed=1e999')).toEqual({});
    expect(optionsFromUrl('?seed=99999999999999999999')).toEqual({});
  });
});
