import { describe, expect, it } from 'vitest';

import { storyStyle } from '@/lib/share/story-style';

describe('storyStyle', () => {
  it('현재 모바일 디자인 토큰과 한글 폰트를 사용한다', () => {
    expect(storyStyle.background).toBe('#ffffff');
    expect(storyStyle.accent).toBe('#506f8f');
    expect(storyStyle.fontFamily).toContain('Malgun Gothic');
  });
});
