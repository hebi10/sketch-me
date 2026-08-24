import { describe, expect, it } from 'vitest';

import { sketchColors } from '@/components/sketch/colors';

describe('sketchColors', () => {
  it('색상 선택 버튼에 사람이 읽을 수 있는 한국어 이름을 제공한다', () => {
    expect(sketchColors).toEqual([
      { value: '#181818', label: '검정' },
      { value: '#6e6e6e', label: '회색' },
      { value: '#506f8f', label: '파랑' },
      { value: '#a35d29', label: '갈색' },
      { value: '#c6a878', label: '베이지' },
    ]);
  });
});
