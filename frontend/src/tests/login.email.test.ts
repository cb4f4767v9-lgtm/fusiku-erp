import { describe, it, expect } from 'vitest';
import { isValidEmailStrict } from '../utils/emailValidation';

describe('Login — email validation', () => {
  it('accepts valid emails', () => {
    expect(isValidEmailStrict('user@example.com')).toBe(true);
  });

  it('rejects invalid emails', () => {
    expect(isValidEmailStrict('not-an-email')).toBe(false);
  });
});
