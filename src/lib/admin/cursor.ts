export type AdminCursor = {
  createdAt: string;
  path: string;
};

export type AdminCursorCollection = 'drawings' | 'purchases' | 'sketchbooks';

function isDocumentPath(path: string) {
  const segments = path.split('/');
  return segments.length >= 2
    && segments.length % 2 === 0
    && segments.every(Boolean);
}

function isAdminCursor(value: unknown): value is AdminCursor {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<AdminCursor>;
  return typeof candidate.createdAt === 'string'
    && !Number.isNaN(Date.parse(candidate.createdAt))
    && typeof candidate.path === 'string'
    && isDocumentPath(candidate.path);
}

export function encodeAdminCursor(value: AdminCursor) {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

export function decodeAdminCursor(value?: string): AdminCursor | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    return isAdminCursor(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function isAdminCursorForCollection(
  cursor: AdminCursor,
  collectionId: AdminCursorCollection,
) {
  const segments = cursor.path.split('/');
  if (collectionId === 'sketchbooks') {
    return segments.length === 2
      && segments[0] === 'sketchbooks'
      && Boolean(segments[1]);
  }

  return segments.length === 4
    && segments[0] === 'sketchbooks'
    && Boolean(segments[1])
    && segments[2] === collectionId
    && Boolean(segments[3]);
}
