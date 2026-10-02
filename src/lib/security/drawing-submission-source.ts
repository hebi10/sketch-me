import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

export const DRAWING_PARTICIPANT_COOKIE = 'sketch_me_participant';
export const DRAWING_PARTICIPANT_MAX_AGE = 180 * 24 * 60 * 60;

export class DrawingParticipantSessionError extends Error {
  constructor() {
    super('참여 정보를 확인하지 못했어요. 브라우저에서 쿠키를 허용하고 페이지를 새로고침해 주세요.');
    this.name = 'DrawingParticipantSessionError';
  }
}

function signature(payload: string, secret: string) {
  if (!secret.trim()) throw new Error('DrawingParticipantSecretMissing');
  return createHmac('sha256', secret.trim()).update(`drawing-participant:v1:${payload}`).digest('hex');
}

export function createDrawingParticipantToken(secret: string, now = new Date()) {
  const expiresAt = Math.floor(now.getTime() / 1_000) + DRAWING_PARTICIPANT_MAX_AGE;
  const payload = `${randomUUID()}.${expiresAt}`;
  return `${payload}.${signature(payload, secret)}`;
}

export function readDrawingParticipantId(token: string | undefined, secret: string, now = new Date()) {
  if (!token || token.length > 160 || !secret.trim()) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [id, expires, mac] = parts;
  if (!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(id)
    || !/^\d{10}$/.test(expires) || !/^[a-f0-9]{64}$/.test(mac)) return null;
  const expiresAt = Number(expires);
  const nowSeconds = Math.floor(now.getTime() / 1_000);
  if (expiresAt <= nowSeconds || expiresAt > nowSeconds + DRAWING_PARTICIPANT_MAX_AGE) return null;
  const expected = signature(`${id}.${expires}`, secret);
  return timingSafeEqual(Buffer.from(mac, 'hex'), Buffer.from(expected, 'hex')) ? id : null;
}

export function getDrawingSubmissionSourceHash(
  request: Request,
  sketchbookSecret: string,
  signingSecret = process.env.PUBLIC_MUTATION_RATE_LIMIT_SECRET ?? '',
  now = new Date(),
) {
  if (!signingSecret.trim()) throw new Error('DrawingParticipantSecretMissing');
  const cookie = request.headers.get('cookie')?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${DRAWING_PARTICIPANT_COOKIE}=`))
    ?.slice(DRAWING_PARTICIPANT_COOKIE.length + 1);
  const participantId = readDrawingParticipantId(cookie, signingSecret, now);
  if (!participantId) throw new DrawingParticipantSessionError();
  return createHmac('sha256', sketchbookSecret)
    .update(`browser:${participantId}`)
    .digest('hex');
}
