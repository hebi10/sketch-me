import { describe, expect, it } from 'vitest';

import { hashManagePin, verifyManagePin } from '@/lib/sketchbooks/manage-pin';

describe('management PIN', () => {
  it('verifies only the PIN used to create the salted hash', async () => {
    const encodedHash = await hashManagePin('1234');

    expect(encodedHash).not.toContain('1234');
    await expect(verifyManagePin('1234', encodedHash)).resolves.toBe(true);
    await expect(verifyManagePin('0000', encodedHash)).resolves.toBe(false);
  });
});
