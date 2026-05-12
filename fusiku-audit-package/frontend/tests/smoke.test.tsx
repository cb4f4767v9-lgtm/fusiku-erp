import { describe, it, expect } from 'vitest';
import { resolveApiV1BaseUrl } from '../src/shared';

describe('shared utilities', () => {
  it('resolveApiV1BaseUrl returns a string', () => {
    const base = resolveApiV1BaseUrl();
    expect(typeof base).toBe('string');
    expect(base.length).toBeGreaterThan(0);
  });
});
