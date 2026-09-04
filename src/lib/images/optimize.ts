import sharp from 'sharp';

export type ImageStorageProfile = 'link-share' | 'sketch' | 'thumbnail';

export interface OptimizedImage {
  buffer: Buffer;
  contentType: 'image/webp';
}

const profiles = {
  'link-share': {
    width: 1200,
    height: 630,
    quality: 76,
    fallbackQuality: 58,
    maxBytes: 350_000,
  },
  sketch: {
    width: 720,
    height: 720,
    quality: 76,
    fallbackQuality: 58,
    maxBytes: 350_000,
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
  const isLinkShare = profile === 'link-share';
  const resizeOptions = {
    width: Math.round((isLinkShare ? 560 : settings.width) * scale),
    height: Math.round((isLinkShare ? 560 : settings.height) * scale),
    fit: 'contain' as const,
    background: { r: 255, g: 255, b: 255, alpha: 1 },
  };

  let pipeline = sharp(input, { failOn: 'error', limitInputPixels: 16_000_000 })
    .rotate()
    .resize(resizeOptions);
  if (isLinkShare) {
    pipeline = pipeline.extend({
      top: Math.round(35 * scale),
      bottom: Math.round(35 * scale),
      left: Math.round(320 * scale),
      right: Math.round(320 * scale),
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    });
  }

  return pipeline
    .webp({ quality, effort: 4, smartSubsample: true })
    .toBuffer();
}

export async function optimizeImageForStorage(input: Buffer, profile: ImageStorageProfile) {
  const settings = profiles[profile];

  try {
    let buffer = await encodeWebp(input, profile, settings.quality);
    if (buffer.byteLength > settings.maxBytes) {
      buffer = await encodeWebp(input, profile, settings.fallbackQuality);
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
