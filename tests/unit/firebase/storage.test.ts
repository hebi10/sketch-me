import {
  getDrawingImagePath,
  getOwnerDrawingPath,
  isDrawingImagePathFor,
  isOwnerDrawingPathFor,
} from '@/lib/firebase/storage';

describe('drawing Storage path', () => {
  it('현재 canonical 경로와 실제 이전 앱의 확장자 없는 경로만 허용한다', () => {
    expect(getDrawingImagePath('book-1', 'draw-1')).toBe(
      'sketchbooks/book-1/drawings/draw-1/original.webp',
    );
    expect(isDrawingImagePathFor(
      'sketchbooks/book-1/drawings/draw-1/original.webp',
      'book-1',
      'draw-1',
    )).toBe(true);
    expect(isDrawingImagePathFor(
      'sketchbooks/book-1/drawings/draw-1/original',
      'book-1',
      'draw-1',
    )).toBe(true);
  });

  it.each([
    'sketchbooks/other-book/drawings/draw-1/original.webp',
    'sketchbooks/book-1/drawings/other-drawing/original.webp',
    'sketchbooks/book-1/owner/original.webp',
    'sketchbooks/book-1/reference/source.webp',
    'sketchbooks/book-1/drawings/draw-1.webp',
    'sketchbooks/book-1/drawings/draw-1/../original.webp',
    'sketchbooks/book-1/drawings/draw-1/%2E%2E/owner/original.webp',
    'sketchbooks/book-1/drawings/draw-1%2Foriginal.webp',
    'sketchbooks/book-1/drawings/draw-1%5Coriginal.webp',
    'sketchbooks/./drawings/draw-1/original.webp',
  ])('다른 대상이나 traversal 가능성이 있는 경로를 거부한다: %s', (path) => {
    expect(isDrawingImagePathFor(path, 'book-1', 'draw-1')).toBe(false);
  });
});

describe('owner Storage path', () => {
  it('canonical WebP와 7498352에서 생성한 scoped legacy PNG만 허용한다', () => {
    expect(getOwnerDrawingPath('book-1')).toBe(
      'sketchbooks/book-1/owner/original.webp',
    );
    expect(isOwnerDrawingPathFor(
      'sketchbooks/book-1/owner/original.webp',
      'book-1',
    )).toBe(true);
    expect(isOwnerDrawingPathFor(
      'sketchbooks/book-1/owner/original.png',
      'book-1',
    )).toBe(true);
  });

  it.each([
    'sketchbooks/other-book/owner/original.png',
    'sketchbooks/book-1/owner/not-original.png',
    'sketchbooks/book-1/owner/original.jpeg',
    'sketchbooks/book-1/drawings/original.png',
    'sketchbooks/book-1/owner/%2e%2e%2freference/source.png',
  ])('다른 PNG나 대상·traversal 경로는 거부한다: %s', (path) => {
    expect(isOwnerDrawingPathFor(path, 'book-1')).toBe(false);
  });
});
