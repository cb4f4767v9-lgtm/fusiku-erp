import { describe, it, expect } from 'vitest';
import { canAccessModule } from '../utils/permissions';

describe('Dashboard — permissions helper', () => {
  it('denies when user is not logged in', () => {
    expect(canAccessModule(null, 'inventory')).toBe(false);
  });
});
