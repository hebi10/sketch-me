import { createHmac } from 'node:crypto';

function getRequestIp(request: Request) {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return (forwarded ?? request.headers.get('x-real-ip') ?? 'unknown')
    .replace(/[^a-fA-F0-9.:]/g, '')
    .slice(0, 64) || 'unknown';
}

export function getDrawingSubmissionSourceHash(request: Request, sketchbookSecret: string) {
  return createHmac('sha256', sketchbookSecret)
    .update(getRequestIp(request))
    .digest('hex');
}
