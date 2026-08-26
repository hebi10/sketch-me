import sharp from 'sharp';

export type ImageStorageProfile = 'sketch' | 'reference' | 'thumbnail';

export interface OptimizedImage {
  buffer: Buffer;
  contentType: 'image/webp';
}

const profiles = {
  sketch: {
    width: 720,
    height: 720,
    quality: 76,
    fallbackQuality: 58,
    maxBytes: 350_000,
  },
  reference: {
    width: 1280,
    height: 1280,
    quality: 72,
    fallbackQuality: 52,
    maxBytes: 600_000,
  },
  thumbnail: {
    width: 320,
    height: 320,
    quality: 68,
    fallbackQuality: 50,
    maxBytes: 90_000,
  },
} as const;

export class ImageOptimizationError extends Error {}

async function encodeWebp(
  input: Buffer,
  profile: ImageStorageProfile,
  quality: number,
  scale = 1,
) {
  const settings = profiles[profile];
  const resizeOptions = profile !== 'reference'
    ? {
        width: Math.round(settings.width * scale),
        height: Math.round(settings.height * scale),
        fit: 'contain' as const,
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      }
    : {
        width: Math.round(settings.width * scale),
        height: Math.round(settings.height * scale),
        fit: 'inside' as const,
        withoutEnlargement: true,
      };

  return sharp(input, { failOn: 'error', limitInputPixels: 16_000_000 })
    .rotate()
    .resize(resizeOptions)
    .webp({ quality, effort: 4, smartSubsample: true })
    .toBuffer();
}

export async function optimizeImageForStorage(input: Buffer, profile: ImageStorageProfile) {
  const settings = profiles[profile];

  try {
    let buffer = await encodeWebp(input, profile, settings.quality);
    if (buffer.byteLength > settings.maxBytes) {
      buffer = await encodeWebp(input, profile, settings.fallbackQuality, profile === 'reference' ? 0.85 : 1);
    }
    if (buffer.byteLength > settings.maxBytes) {
      throw new ImageOptimizationError(
        `이미지 용량을 ${Math.round(settings.maxBytes / 1000)}KB 이하로 줄이지 못했어요. 더 단순한 이미지를 선택해 주세요.`,
      );
    }
    return { buffer, contentType: 'image/webp' as const };
  } catch (error) {
    if (error instanceof ImageOptimizationError) throw error;
    throw new ImageOptimizationError('이미지를 읽거나 WebP로 변환하지 못했어요. 다른 이미지를 선택해 주세요.');
  }
}

export function optimizeDrawingThumbnail(input: Buffer) {
  return optimizeImageForStorage(input, 'thumbnail');
}

export async function optimizeDrawingImages(input: Buffer) {
  const [original, thumbnail] = await Promise.all([
    optimizeImageForStorage(input, 'sketch'),
    optimizeDrawingThumbnail(input),
  ]);

  return { original, thumbnail };
}
