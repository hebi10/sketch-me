import { describe, expect, it } from 'vitest';

import { galleryImageLoading } from '@/lib/images/loading';

describe('galleryImageLoading', () => {
  it('첫 갤러리 이미지만 즉시 불러온다', () => {
    expect(galleryImageLoading(0)).toBe('eager');
    expect(galleryImageLoading(1)).toBe('lazy');
  });
});
