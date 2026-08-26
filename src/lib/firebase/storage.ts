const allowedImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

export function assertSupportedImageType(contentType: string) {
  if (!allowedImageTypes.has(contentType)) {
    throw new Error('지원하지 않는 이미지 형식입니다. JPG, PNG, WEBP 파일만 올려주세요.');
  }
}

export function getReferenceImagePath(sketchbookId: string) {
  return `sketchbooks/${sketchbookId}/reference/source.webp`;
}

export function getOwnerDrawingPath(sketchbookId: string) {
  return `sketchbooks/${sketchbookId}/owner/original.webp`;
}

export function isOwnerDrawingPathFor(imagePath: string, sketchbookId: string) {
  const segments = imagePath.split('/');
  if (
    segments.length !== 4
    || !segments.every(isSafeStoragePathSegment)
    || !isSafeStoragePathSegment(sketchbookId)
  ) {
    return false;
  }

  const [root, pathSketchbookId, collection, filename] = segments;
  return root === 'sketchbooks'
    && pathSketchbookId === sketchbookId
    && collection === 'owner'
    && (filename === 'original.webp' || filename === 'original.png');
}

export function getDrawingImagePath(sketchbookId: string, drawingId: string) {
  return `sketchbooks/${sketchbookId}/drawings/${drawingId}/original.webp`;
}

export function getDrawingThumbnailPath(sketchbookId: string, drawingId: string) {
  return `sketchbooks/${sketchbookId}/drawings/${drawingId}/thumbnail.webp`;
}

function isSafeStoragePathSegment(value: string) {
  if (!value || value === '.' || value === '..' || value.includes('\\')) {
    return false;
  }

  let decoded = value;
  for (let index = 0; index < 4; index += 1) {
    try {
      const next = decodeURIComponent(decoded);
      if (
        next === '.'
        || next === '..'
        || next.includes('/')
        || next.includes('\\')
      ) {
        return false;
      }
      if (next === decoded) return true;
      decoded = next;
    } catch {
      return false;
    }
  }

  return false;
}

export function isDrawingImagePathFor(
  imagePath: string,
  sketchbookId: string,
  drawingId: string,
) {
  const segments = imagePath.split('/');
  if (
    segments.length !== 5
    || !segments.every(isSafeStoragePathSegment)
    || !isSafeStoragePathSegment(sketchbookId)
    || !isSafeStoragePathSegment(drawingId)
  ) {
    return false;
  }

  const [root, pathSketchbookId, collection, pathDrawingId, filename] = segments;
  if (
    root !== 'sketchbooks'
    || pathSketchbookId !== sketchbookId
    || collection !== 'drawings'
    || pathDrawingId !== drawingId
  ) {
    return false;
  }

  // Before the WebP storage normalization, drawing objects used the same
  // scoped path with an extensionless `original` filename.
  return filename === 'original.webp' || filename === 'original';
}

export function isDrawingThumbnailPathFor(
  imagePath: string,
  sketchbookId: string,
  drawingId: string,
) {
  const segments = imagePath.split('/');
  if (
    segments.length !== 5
    || !segments.every(isSafeStoragePathSegment)
    || !isSafeStoragePathSegment(sketchbookId)
    || !isSafeStoragePathSegment(drawingId)
  ) {
    return false;
  }

  const [root, pathSketchbookId, collection, pathDrawingId, filename] = segments;
  return root === 'sketchbooks'
    && pathSketchbookId === sketchbookId
    && collection === 'drawings'
    && pathDrawingId === drawingId
    && filename === 'thumbnail.webp';
}

export function getShareImagePath(sketchbookId: string, shareImageId: string) {
  return `sketchbooks/${sketchbookId}/share-images/${shareImageId}/story.png`;
}
