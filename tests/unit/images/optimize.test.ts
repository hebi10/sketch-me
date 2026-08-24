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

async function makeMarkedPortrait() {
  const width = 1440;
  const height = 1920;
  const pixels = Buffer.alloc(width * height * 3, 247);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 3;
      if (y < 120) {
        pixels[offset] = 220;
        pixels[offset + 1] = 30;
        pixels[offset + 2] = 30;
      } else if (y >= height - 120) {
        pixels[offset] = 30;
        pixels[offset + 1] = 70;
        pixels[offset + 2] = 220;
      }
    }
  }
  return sharp(pixels, { raw: { width, height, channels: 3 } }).png().toBuffer();
}

async function makeNoisySquare() {
  const size = 720;
  const pixels = Buffer.alloc(size * size * 3);
  let seed = 20260824;
  for (let index = 0; index < pixels.length; index += 1) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    pixels[index] = seed & 0xff;
  }
  return sharp(pixels, { raw: { width: size, height: size, channels: 3 } }).png().toBuffer();
}

describe('optimizeImageForStorage', () => {
  it('stores a sketch as a bounded WebP image', async () => {
    const result = await optimizeImageForStorage(await makeMarkedPortrait(), 'sketch');
    const metadata = await sharp(result.buffer).metadata();
    const { data, info } = await sharp(result.buffer).raw().toBuffer({ resolveWithObject: true });
    const pixel = (x: number, y: number) => {
      const offset = (y * info.width + x) * info.channels;
      return [data[offset], data[offset + 1], data[offset + 2]];
    };

    expect(result.contentType).toBe('image/webp');
    expect(metadata.format).toBe('webp');
    expect(metadata.width).toBe(720);
    expect(metadata.height).toBe(720);
    expect(pixel(360, 20)[0]).toBeGreaterThan(180);
    expect(pixel(360, 20)[1]).toBeLessThan(80);
    expect(pixel(360, 700)[2]).toBeGreaterThan(180);
    expect(pixel(20, 360).every((value) => value > 235)).toBe(true);
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

  it('keeps a complex sketch at 720 square while lowering WebP quality', async () => {
    const result = await optimizeImageForStorage(await makeNoisySquare(), 'sketch');
    const metadata = await sharp(result.buffer).metadata();

    expect(metadata.width).toBe(720);
    expect(metadata.height).toBe(720);
    expect(result.buffer.byteLength).toBeLessThanOrEqual(350_000);
  });

  it('rejects corrupt image bytes', async () => {
    await expect(optimizeImageForStorage(Buffer.from('not-an-image'), 'sketch')).rejects.toThrow('이미지');
  });
});
