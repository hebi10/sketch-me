import { describe, expect, it } from 'vitest';

import {
  buildFriendShareDrawingOptions,
  buildOwnerShareDrawingOption,
  filterShareDrawings,
  parseShareImageMode,
  type ShareDrawingOption,
  SINGLE_IMAGE_DEFAULT_HEADING,
} from '@/lib/share/share-image';

describe('공유 이미지 모델', () => {
  it.each([
    ['single', 'single'],
    ['best', 'best'],
    ['BEST', null],
    ['', null],
    [undefined, null],
  ])('모드 %p를 %p로 해석한다', (value, expected) => {
    expect(parseShareImageMode(value)).toBe(expected);
  });

  it('한 장 이미지의 기본 제목을 고정한다', () => {
    expect(SINGLE_IMAGE_DEFAULT_HEADING).toBe('친구가 그린 나');
  });

  it('작성자 이름의 공백을 정리하고 부분 일치하는 친구 그림을 모두 찾는다', () => {
    const drawings: ShareDrawingOption[] = [
      { authorName: '해비', bestRank: 1, createdAt: '2026-09-01T00:00:00.000Z', id: 'a', imageUrl: '/a', source: 'friend' },
      { authorName: '해비 친구', bestRank: null, createdAt: '2026-09-02T00:00:00.000Z', id: 'b', imageUrl: '/b', source: 'friend' },
      { authorName: '다른 친구', bestRank: null, createdAt: '2026-09-03T00:00:00.000Z', id: 'c', imageUrl: '/c', source: 'friend' },
    ];

    expect(filterShareDrawings(drawings, '  해비 ')).toEqual(drawings.slice(0, 2));
    expect(filterShareDrawings(drawings, '')).toEqual([]);
  });

  it('공개 가능 상태의 친구 그림만 제작 후보로 만든다', () => {
    const createdAt = new Date('2026-09-01T00:00:00.000Z');
    const base = {
      authorName: '친구',
      bestRank: null,
      createdAt,
      imagePath: 'sketchbooks/book/drawing.webp',
      publicImageVersion: 'v1',
      thumbnailPath: null,
      message: null,
      moderatedAt: null,
      sketchbookId: 'book',
      sketchbookName: '해비',
      sketchbookPublicId: 'public-1',
      updatedAt: createdAt,
    };
    const result = buildFriendShareDrawingOptions('public-1', [
      { ...base, id: 'active', moderationStatus: 'ACTIVE', status: 'VISIBLE' },
      { ...base, id: 'hidden', moderationStatus: 'ACTIVE', status: 'HIDDEN' },
      { ...base, id: 'blocked', moderationStatus: 'BLOCKED', status: 'VISIBLE' },
    ]);

    expect(result).toEqual([expect.objectContaining({
      id: 'active',
      imageUrl: '/api/manage/public-1/drawings/active/image',
      source: 'friend',
    })]);
  });

  it('저장된 소유자 그림을 별도 제작 후보로 만든다', () => {
    expect(buildOwnerShareDrawingOption('public-1', {
      name: '해비',
      ownerBestRank: 2,
      ownerDrawingPath: 'sketchbooks/book/owner.webp',
    })).toEqual({
      authorName: '해비',
      bestRank: 2,
      createdAt: null,
      id: 'owner',
      imageUrl: '/api/manage/public-1/owner/image',
      source: 'owner',
    });
    expect(buildOwnerShareDrawingOption('public-1', {
      name: '해비',
      ownerBestRank: null,
      ownerDrawingPath: null,
    })).toBeNull();
  });
});
