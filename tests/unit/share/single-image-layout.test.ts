import { describe, expect, it } from 'vitest';

import {
  fitContainedRect,
  SINGLE_IMAGE_LAYOUT,
} from '@/lib/share/single-image-layout';

describe('정사각형 공유 이미지 레이아웃', () => {
  it('1080 정사각형의 제목, 그림, 작성자, 워터마크 영역을 고정한다', () => {
    expect(SINGLE_IMAGE_LAYOUT).toEqual({
      authorY: 946,
      frame: { height: 720, width: 780, x: 150, y: 180 },
      height: 1080,
      titleY: 112,
      watermark: { height: 60, width: 360, x: 360, y: 994 },
      width: 1080,
    });
  });

  it('세로 이미지를 프레임 중앙에 잘리지 않게 맞춘다', () => {
    expect(fitContainedRect(800, 1200, SINGLE_IMAGE_LAYOUT.frame)).toEqual({
      height: 720,
      width: 480,
      x: 300,
      y: 180,
    });
  });

  it('가로 이미지를 프레임 중앙에 잘리지 않게 맞춘다', () => {
    expect(fitContainedRect(1200, 800, SINGLE_IMAGE_LAYOUT.frame)).toEqual({
      height: 520,
      width: 780,
      x: 150,
      y: 280,
    });
  });

  it('이미지 크기가 유효하지 않으면 제작을 중단한다', () => {
    expect(() => fitContainedRect(0, 800, SINGLE_IMAGE_LAYOUT.frame)).toThrow(
      '이미지 크기를 확인하지 못했습니다.',
    );
    expect(() => fitContainedRect(Number.NaN, 800, SINGLE_IMAGE_LAYOUT.frame)).toThrow(
      '이미지 크기를 확인하지 못했습니다.',
    );
    expect(() => fitContainedRect(800, Number.POSITIVE_INFINITY, SINGLE_IMAGE_LAYOUT.frame)).toThrow(
      '이미지 크기를 확인하지 못했습니다.',
    );
  });
});
