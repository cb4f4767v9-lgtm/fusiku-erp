import { describe, it, expect } from 'vitest';

describe('Sales UI — number formatting sanity', () => {
  it('formats currency-like numbers', () => {
    expect(Number((1234.56).toFixed(2))).toBe(1234.56);
  });
});
