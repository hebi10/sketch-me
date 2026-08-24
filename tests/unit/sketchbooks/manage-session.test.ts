import { describe, expect, it } from 'vitest';

import { isValidManageSession, parseManageSession } from '@/lib/sketchbooks/manage-session';

describe('manage sessions', () => {
  it('parses the public identifier and token from a management cookie', () => {
    expect(parseManageSession('book-12.token-value')).toEqual({
      publicId: 'book-12',
      token: 'token-value',
    });
  });

  it('only accepts a session that matches both the sketchbook and token hash', () => {
    expect(isValidManageSession({ publicId: 'book-12', token: 'token-value' }, 'book-12', 'hashed')).toBe(false);
    expect(isValidManageSession({ publicId: 'book-12', token: 'token-value' }, 'book-12', 'e6c02a5742ea9d4de588eb9b9de7bed43dc17011552186bed3e98b2c5958ff4a')).toBe(true);
  });
});
