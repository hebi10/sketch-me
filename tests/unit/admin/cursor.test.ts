import { decodeAdminCursor, encodeAdminCursor } from '@/lib/admin/cursor';

describe('admin cursor', () => {
  it('createdAt과 전체 문서 경로를 불투명 커서로 왕복한다', () => {
    const value = {
      createdAt: '2026-08-25T00:00:00.000Z',
      path: 'sketchbooks/book-1/drawings/draw-1',
    };

    const cursor = encodeAdminCursor(value);

    expect(cursor).not.toContain('sketchbooks');
    expect(decodeAdminCursor(cursor)).toEqual(value);
  });

  it('형식이 잘못된 커서를 거부한다', () => {
    const invalidPayload = Buffer.from(JSON.stringify({
      createdAt: 'not-a-date',
      path: 'draw-1',
    }), 'utf8').toString('base64url');

    expect(decodeAdminCursor()).toBeNull();
    expect(decodeAdminCursor('invalid')).toBeNull();
    expect(decodeAdminCursor(invalidPayload)).toBeNull();
  });
});
