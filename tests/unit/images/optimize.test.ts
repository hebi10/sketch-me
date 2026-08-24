import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

import { optimizeImageForStorage } from '@/lib/images/optimize';

async function makePng(width: number, height: number) {
  return sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 247, g: 244, b: 238, alpha: 1 },
    },
  }).png().toBuffer();
}

describe('optimizeImageForStorage', () => {
  it('stores a sketch as a bounded WebP image', async () => {
    const result = await optimizeImageForStorage(await makePng(1440, 1920), 'sketch');
    const metadata = await sharp(result.buffer).metadata();

    expect(result.contentType).toBe('image/webp');
    expect(metadata.format).toBe('webp');
    expect(metadata.width).toBeLessThanOrEqual(720);
    expect(metadata.height).toBeLessThanOrEqual(960);
    expect(result.buffer.byteLength).toBeLessThanOrEqual(350_000);
  });

  it('rotates and bounds a reference image', async () => {
    const source = await sharp(await makePng(2400, 1600)).withMetadata({ orientation: 6 }).toBuffer();
    const result = await optimizeImageForStorage(source, 'reference');
    const metadata = await sharp(result.buffer).metadata();

    expect(metadata.format).toBe('webp');
    expect(metadata.width).toBeLessThanOrEqual(1280);
    expect(metadata.height).toBeLessThanOrEqual(1280);
    expect(result.buffer.byteLength).toBeLessThanOrEqual(600_000);
  });

  it('rejects corrupt image bytes', async () => {
    await expect(optimizeImageForStorage(Buffer.from('not-an-image'), 'sketch')).rejects.toThrow('이미지');
  });
});
