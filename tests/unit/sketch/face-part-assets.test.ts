import { access, stat } from 'node:fs/promises';
import path from 'node:path';

import sharp from 'sharp';

import { FACE_PARTS } from '@/components/sketch/face-parts';

describe('얼굴 파츠 이미지', () => {
  it('모든 자산이 가벼운 720 정사각형 투명 WebP다', async () => {
    for (const option of Object.values(FACE_PARTS).flat()) {
      const file = path.join(process.cwd(), 'public', option.src.replace(/^\//, ''));
      await access(file);

      const metadata = await sharp(file).metadata();
      expect(metadata).toMatchObject({
        format: 'webp',
        hasAlpha: true,
        height: 720,
        width: 720,
      });
      expect((await sharp(file).stats()).isOpaque).toBe(false);
      expect((await stat(file)).size).toBeLessThan(250 * 1024);
    }
  });
});
