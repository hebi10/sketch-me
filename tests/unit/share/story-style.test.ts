import { describe, expect, it } from 'vitest';

import { storyStyle } from '@/lib/share/story-style';

describe('storyStyle', () => {
  it('현재 모바일 디자인 토큰과 한글 폰트를 사용한다', () => {
    expect(storyStyle.background).toBe('#f7f4ee');
    expect(storyStyle.backgroundImage).toBe('/story/sketchbook-story-background.webp');
    expect(storyStyle.accent).toBe('#506f8f');
    expect(storyStyle.fontFamily).toContain('Gaegu');
  });
});
