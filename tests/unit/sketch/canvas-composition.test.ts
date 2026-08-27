import { vi } from 'vitest';

import {
  createCompositeDrawing,
  hasDrawingContent,
} from '@/components/sketch/canvas-composition';

describe('그림 합성', () => {
  it('흰 배경, 선택 파츠, 자유 그리기 순서로 WebP를 만든다', async () => {
    const outputContext = {
      drawImage: vi.fn(),
      fillRect: vi.fn(),
      fillStyle: '',
    };
    const outputCanvas = {
      getContext: () => outputContext,
      height: 0,
      toDataURL: vi.fn(() => 'data:image/webp;base64,result'),
      width: 0,
    } as unknown as HTMLCanvasElement;
    const drawingCanvas = document.createElement('canvas');
    const faceImage = {} as HTMLImageElement;

    const result = await createCompositeDrawing({
      createCanvas: () => outputCanvas,
      drawingCanvas,
      facePartSources: ['/face.webp'],
      loadImage: async () => faceImage,
    });

    expect(outputCanvas.width).toBe(720);
    expect(outputCanvas.height).toBe(720);
    expect(outputContext.fillStyle).toBe('#ffffff');
    expect(outputContext.fillRect).toHaveBeenCalledWith(0, 0, 720, 720);
    expect(outputContext.drawImage.mock.calls).toEqual([
      [faceImage, 0, 0, 720, 720],
      [drawingCanvas, 0, 0],
    ]);
    expect(outputCanvas.toDataURL).toHaveBeenCalledWith('image/webp', 0.76);
    expect(result).toBe('data:image/webp;base64,result');
  });

  it('선택한 파츠를 전달받은 순서 그대로 합성한다', async () => {
    const outputContext = { drawImage: vi.fn(), fillRect: vi.fn(), fillStyle: '' };
    const outputCanvas = {
      getContext: () => outputContext,
      height: 0,
      toDataURL: () => 'data:image/webp;base64,result',
      width: 0,
    } as unknown as HTMLCanvasElement;
    const drawingCanvas = document.createElement('canvas');
    const loaded = new Map([
      ['/face.webp', { id: 'face' } as unknown as HTMLImageElement],
      ['/eyes.webp', { id: 'eyes' } as unknown as HTMLImageElement],
    ]);

    await createCompositeDrawing({
      createCanvas: () => outputCanvas,
      drawingCanvas,
      facePartSources: ['/face.webp', '/eyes.webp'],
      loadImage: async (source) => loaded.get(source)!,
    });

    expect(outputContext.drawImage.mock.calls).toEqual([
      [loaded.get('/face.webp'), 0, 0, 720, 720],
      [loaded.get('/eyes.webp'), 0, 0, 720, 720],
      [drawingCanvas, 0, 0],
    ]);
  });

  it('얼굴 파츠만 있어도 저장 가능한 그림으로 판단한다', () => {
    const drawingCanvas = document.createElement('canvas');
    vi.spyOn(drawingCanvas, 'getContext').mockReturnValue({
      getImageData: () => ({ data: new Uint8ClampedArray(4) }),
    } as unknown as CanvasRenderingContext2D);

    expect(hasDrawingContent(drawingCanvas, ['/face.webp'])).toBe(true);
    expect(hasDrawingContent(drawingCanvas, [])).toBe(false);
  });

  it('자유 그리기 알파 픽셀이 있으면 파츠 없이도 저장 가능하다', () => {
    const drawingCanvas = document.createElement('canvas');
    vi.spyOn(drawingCanvas, 'getContext').mockReturnValue({
      getImageData: () => ({ data: new Uint8ClampedArray([0, 0, 0, 1]) }),
    } as unknown as CanvasRenderingContext2D);

    expect(hasDrawingContent(drawingCanvas, [])).toBe(true);
  });
});
