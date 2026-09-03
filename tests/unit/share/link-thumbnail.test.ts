import { describe, expect, it } from 'vitest';

import { resolveLinkShareThumbnail } from '@/lib/share/link-thumbnail';

describe('링크 공유 기본 썸네일', () => {
  it('기본 썸네일 선택 시 브랜드 이미지와 갱신 가능한 공유 버전을 제공한다', () => {
    const updatedAt = new Date('2026-09-03T06:00:00.000Z');

    expect(resolveLinkShareThumbnail({
      createdAt: updatedAt,
      entitlements: { watermarkFree: false },
      id: 'book-1',
      manageTokenHash: 'hash',
      moderatedAt: null,
      moderationStatus: 'ACTIVE',
      name: '해비',
      ownerDrawingPath: null,
      participantCount: 0,
      participantLimit: 10,
      publicId: 'public-1',
      shareThumbnailMode: 'DEFAULT',
      status: 'PUBLIC',
      updatedAt,
    })).toEqual({
      alt: '해비님의 스캐치북',
      height: 630,
      previewVersion: `default-${updatedAt.getTime().toString(36)}`,
      url: '/brand/sketchbook-kakao-share.webp',
      width: 1200,
    });
  });
});
