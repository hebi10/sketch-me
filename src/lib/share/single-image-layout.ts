export interface Rect {
  height: number;
  width: number;
  x: number;
  y: number;
}

export const SINGLE_IMAGE_LAYOUT = {
  authorY: 946,
  frame: { height: 720, width: 780, x: 150, y: 180 },
  height: 1080,
  titleY: 112,
  watermark: { height: 60, width: 360, x: 360, y: 994 },
  width: 1080,
} as const;

export function fitContainedRect(
  imageWidth: number,
  imageHeight: number,
  frame: Rect,
): Rect {
  if (
    !Number.isFinite(imageWidth)
    || !Number.isFinite(imageHeight)
    || imageWidth <= 0
    || imageHeight <= 0
  ) {
    throw new Error('이미지 크기를 확인하지 못했습니다.');
  }

  const scale = Math.min(frame.width / imageWidth, frame.height / imageHeight);
  const width = Math.round(imageWidth * scale);
  const height = Math.round(imageHeight * scale);

  return {
    height,
    width,
    x: frame.x + Math.round((frame.width - width) / 2),
    y: frame.y + Math.round((frame.height - height) / 2),
  };
}
