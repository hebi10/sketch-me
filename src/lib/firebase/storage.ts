const allowedImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

export function assertSupportedImageType(contentType: string) {
  if (!allowedImageTypes.has(contentType)) {
    throw new Error('지원하지 않는 이미지 형식입니다. JPG, PNG, WEBP 파일만 올려주세요.');
  }
}

export function getReferenceImagePath(sketchbookId: string) {
  return `sketchbooks/${sketchbookId}/reference/source`;
}

export function getOwnerDrawingPath(sketchbookId: string) {
  return `sketchbooks/${sketchbookId}/owner/original.png`;
}

export function getDrawingImagePath(sketchbookId: string, drawingId: string) {
  return `sketchbooks/${sketchbookId}/drawings/${drawingId}/original`;
}

export function getShareImagePath(sketchbookId: string, shareImageId: string) {
  return `sketchbooks/${sketchbookId}/share-images/${shareImageId}/story.png`;
}
