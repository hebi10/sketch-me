import { describe, expect, it } from 'vitest';

import { createSketchbookDraft } from '@/lib/sketchbooks/create';

describe('createSketchbookDraft', () => {
  it('creates a public sketchbook with the free participant limit', () => {
    const draft = createSketchbookDraft({
      id: 'book_123',
      publicId: 'doyoung-abc123',
      name: '  테스트사용자  ',
      managePinHash: 'scrypt$test$hash',
      managePinHint: '생일 네 자리',
      manageTokenHash: 'hashed-token',
      ownerDrawingPath: 'sketchbooks/book_123/owner/original.png',
      createdAt: new Date('2026-08-24T00:00:00.000Z'),
    });

    expect(draft).toMatchObject({
      id: 'book_123',
      publicId: 'doyoung-abc123',
      name: '테스트사용자',
      managePinHash: 'scrypt$test$hash',
      managePinHint: '생일 네 자리',
      managePinEnabledAt: new Date('2026-08-24T00:00:00.000Z'),
      manageTokenHash: 'hashed-token',
      participantLimit: 10,
      participantCount: 0,
      entitlements: { watermarkFree: false },
      moderationStatus: 'ACTIVE',
      moderatedAt: null,
      shareThumbnailMode: 'DEFAULT',
      status: 'PUBLIC',
      storyHeading: '친구들이 그린 내 모습',
    });
    expect(draft).not.toHaveProperty('referenceImagePath');
    expect(draft).not.toHaveProperty('referenceImageEnabled');
  });
});
