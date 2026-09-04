const supportedTypes = new Set(['image/png', 'image/jpeg', 'image/webp']);

export const MAX_SKETCH_IMPORT_BYTES = 10 * 1024 * 1024;

export function validateSketchImport(file: File): string | null {
  if (!supportedTypes.has(file.type)) return 'PNG, JPEG, WebP 이미지만 가져올 수 있어요.';
  if (file.size > MAX_SKETCH_IMPORT_BYTES) return '10MB 이하 이미지를 선택해 주세요.';
  return null;
}

export function getContainedRect(sourceWidth: number, sourceHeight: number, targetWidth: number, targetHeight: number) {
  const scale = Math.min(targetWidth / sourceWidth, targetHeight / sourceHeight);
  const width = sourceWidth * scale;
  const height = sourceHeight * scale;

  return {
    x: (targetWidth - width) / 2,
    y: (targetHeight - height) / 2,
    width,
    height,
  };
}

function getSourceDimensions(source: CanvasImageSource) {
  const image = source as CanvasImageSource & {
    height?: number;
    naturalHeight?: number;
    naturalWidth?: number;
    videoHeight?: number;
    videoWidth?: number;
    width?: number;
  };
  const width = image.naturalWidth ?? image.videoWidth ?? image.width;
  const height = image.naturalHeight ?? image.videoHeight ?? image.height;
  if (!width || !height) throw new Error('가져온 이미지 크기를 확인하지 못했어요.');
  return { width, height };
}

export function drawImportedImage(canvas: HTMLCanvasElement, source: CanvasImageSource): void {
  const context = canvas.getContext('2d');
  if (!context) throw new Error('그림을 불러오지 못했어요. 다시 시도해 주세요.');
  const { width: sourceWidth, height: sourceHeight } = getSourceDimensions(source);
  const rect = getContainedRect(sourceWidth, sourceHeight, canvas.width, canvas.height);

  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(source, rect.x, rect.y, rect.width, rect.height);
}
