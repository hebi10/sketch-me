import { describe, expect, it } from 'vitest';

import {
  parseShareImageMode,
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
});
