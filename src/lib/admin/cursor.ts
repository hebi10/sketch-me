export type AdminCursor = {
  createdAt: string;
  path: string;
};

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
