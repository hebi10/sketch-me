const canvasSize = 720;

export interface CompositeDrawingOptions {
  createCanvas?: () => HTMLCanvasElement;
  drawingCanvas: HTMLCanvasElement;
  facePartSources: string[];
  loadImage?: (src: string) => Promise<HTMLImageElement>;
}

function loadCanvasImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`얼굴 파츠를 불러오지 못했습니다: ${src}`));
    image.src = src;
  });
}

export function hasDrawingContent(
  drawingCanvas: HTMLCanvasElement,
  facePartSources: string[],
): boolean {
  if (facePartSources.length > 0) return true;
  const context = drawingCanvas.getContext('2d', { willReadFrequently: true });
  if (!context) return false;
  const pixels = context.getImageData(0, 0, canvasSize, canvasSize).data;
  for (let index = 3; index < pixels.length; index += 4) {
    if (pixels[index] !== 0) return true;
  }
  return false;
}

export async function createCompositeDrawing({
  createCanvas = () => document.createElement('canvas'),
  drawingCanvas,
  facePartSources,
  loadImage = loadCanvasImage,
}: CompositeDrawingOptions): Promise<string> {
  const output = createCanvas();
  output.width = canvasSize;
  output.height = canvasSize;
  const context = output.getContext('2d');
  if (!context) throw new Error('그림을 합성할 수 없습니다.');

  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvasSize, canvasSize);
  for (const source of facePartSources) {
    context.drawImage(await loadImage(source), 0, 0, canvasSize, canvasSize);
  }
  context.drawImage(drawingCanvas, 0, 0);
  return output.toDataURL('image/webp', 0.76);
}
