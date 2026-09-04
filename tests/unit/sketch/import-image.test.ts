import { describe, expect, it, vi } from 'vitest';

import {
  drawImportedImage,
  getContainedRect,
  validateSketchImport,
} from '@/components/sketch/import-image';

describe('스케치 이미지 가져오기', () => {
  it('지원하지 않는 형식과 10MB 초과 파일을 거절한다', () => {
    expect(validateSketchImport(new File(['x'], 'drawing.gif', { type: 'image/gif' }))).toBe('PNG, JPEG, WebP 이미지만 가져올 수 있어요.');
    const large = new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'large.png', { type: 'image/png' });

    expect(validateSketchImport(large)).toBe('10MB 이하 이미지를 선택해 주세요.');
  });

  it('세로 이미지를 720 정사각형 안에 contain으로 배치한다', () => {
    expect(getContainedRect(900, 1200, 720, 720)).toEqual({ x: 90, y: 0, width: 540, height: 720 });
  });

  it('흰 배경의 720 정사각형 캔버스에 contain으로 이미지를 그린다', () => {
    const context = {
      drawImage: vi.fn(),
      fillRect: vi.fn(),
      fillStyle: '',
    };
    const canvas = {
      getContext: vi.fn(() => context),
      height: 720,
      width: 720,
    } as unknown as HTMLCanvasElement;
    const source = { height: 1200, width: 900 } as unknown as CanvasImageSource;

    drawImportedImage(canvas, source);

    expect(context.fillStyle).toBe('#ffffff');
    expect(context.fillRect).toHaveBeenCalledWith(0, 0, 720, 720);
    expect(context.drawImage).toHaveBeenCalledWith(source, 90, 0, 540, 720);
  });
});
