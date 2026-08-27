const maxSourceBytes = 20 * 1024 * 1024;
const maxReferenceDimension = 1280;
const targetReferenceBytes = 600_000;

const encodingAttempts = [
  { quality: 0.78, scale: 1 },
  { quality: 0.68, scale: 1 },
  { quality: 0.58, scale: 1 },
  { quality: 0.56, scale: 0.88 },
  { quality: 0.52, scale: 0.76 },
  { quality: 0.48, scale: 0.64 },
] as const;

export class ClientImageCompressionError extends Error {}

interface LoadedImage {
  dispose: () => void;
  height: number;
  source: CanvasImageSource;
  width: number;
}

async function loadImage(file: File): Promise<LoadedImage> {
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    return {
      dispose: () => bitmap.close(),
      height: bitmap.height,
      source: bitmap,
      width: bitmap.width,
    };
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('image decode failed'));
      image.src = objectUrl;
    });
    return {
      dispose: () => URL.revokeObjectURL(objectUrl),
      height: image.naturalHeight,
      source: image,
      width: image.naturalWidth,
    };
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw error;
  }
}

function encodeWebp(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob || blob.type !== 'image/webp') {
        reject(new ClientImageCompressionError('사진을 압축하지 못했습니다. 다른 사진을 선택해 주세요.'));
        return;
      }
      resolve(blob);
    }, 'image/webp', quality);
  });
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new ClientImageCompressionError('사진을 압축하지 못했습니다. 다른 사진을 선택해 주세요.'));
    };
    reader.onerror = () => reject(new ClientImageCompressionError('사진을 압축하지 못했습니다. 다른 사진을 선택해 주세요.'));
    reader.readAsDataURL(blob);
  });
}

export async function compressReferenceImage(file: File) {
  if (file.size > maxSourceBytes) {
    throw new ClientImageCompressionError('원본 참고 사진은 20MB 이하로 선택해 주세요.');
  }

  let image: LoadedImage | null = null;
  try {
    image = await loadImage(file);
    if (!image.width || !image.height) throw new Error('invalid image dimensions');

    const baseScale = Math.min(1, maxReferenceDimension / Math.max(image.width, image.height));
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) throw new Error('canvas context unavailable');

    for (const attempt of encodingAttempts) {
      canvas.width = Math.max(1, Math.round(image.width * baseScale * attempt.scale));
      canvas.height = Math.max(1, Math.round(image.height * baseScale * attempt.scale));
      context.drawImage(image.source, 0, 0, canvas.width, canvas.height);
      const blob = await encodeWebp(canvas, attempt.quality);
      if (blob.size <= targetReferenceBytes) return blobToDataUrl(blob);
    }

    throw new ClientImageCompressionError('사진 용량을 충분히 줄이지 못했습니다. 다른 사진을 선택해 주세요.');
  } catch (error) {
    if (error instanceof ClientImageCompressionError) throw error;
    throw new ClientImageCompressionError('사진을 압축하지 못했습니다. 다른 사진을 선택해 주세요.');
  } finally {
    image?.dispose();
  }
}
