import { describe, expect, it } from 'vitest';

import {
  createDrawingParticipantToken,
  DRAWING_PARTICIPANT_COOKIE,
  DrawingParticipantSessionError,
  getDrawingSubmissionSourceHash,
  readDrawingParticipantId,
} from '@/lib/security/drawing-submission-source';

describe('친구 그림 제출 출처', () => {
  const signingSecret = 'test-only-participant-signing-secret';
  const now = new Date('2026-10-02T00:00:00Z');
  const firstToken = () => createDrawingParticipantToken(signingSecret, now);
  function participantRequest(token: string, ip = '203.0.113.10') {
    return new Request('https://example.com', {
      headers: { cookie: `${DRAWING_PARTICIPANT_COOKIE}=${token}`, 'x-forwarded-for': ip },
    });
  }

  it('같은 IP에서도 별도 브라우저는 제출 한도를 공유하지 않는다', () => {
    const first = participantRequest(firstToken());
    const second = participantRequest(firstToken());
    expect(getDrawingSubmissionSourceHash(first, 'book-secret', signingSecret, now))
      .not.toBe(getDrawingSubmissionSourceHash(second, 'book-secret', signingSecret, now));
  });

  it('같은 브라우저는 IP가 바뀌어도 같은 스케치북 한도를 유지한다', () => {
    const token = firstToken();
    expect(getDrawingSubmissionSourceHash(participantRequest(token), 'book-secret', signingSecret, now))
      .toBe(getDrawingSubmissionSourceHash(participantRequest(token, '198.51.100.2'), 'book-secret', signingSecret, now));
  });

  it('서로 다른 스케치북에는 별도 비식별 해시를 사용한다', () => {
    const request = participantRequest(firstToken());
    const hash = getDrawingSubmissionSourceHash(request, 'book-a', signingSecret, now);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).not.toBe(getDrawingSubmissionSourceHash(request, 'book-b', signingSecret, now));
  });

  it('쿠키가 없거나 위조되면 IP 식별로 우회하지 않는다', () => {
    for (const request of [new Request('https://example.com'), participantRequest('forged'), participantRequest(`${firstToken()}x`)]) {
      expect(() => getDrawingSubmissionSourceHash(request, 'book-secret', signingSecret, now))
        .toThrow(DrawingParticipantSessionError);
    }
  });

  it('다른 서명 키와 만료된 쿠키를 거절한다', () => {
    const token = firstToken();
    expect(readDrawingParticipantId(token, 'different-secret', now)).toBeNull();
    expect(readDrawingParticipantId(token, signingSecret, new Date('2027-10-02T00:00:00Z'))).toBeNull();
  });

  it('서명 키 누락은 설정 오류로 처리한다', () => {
    expect(() => createDrawingParticipantToken('', now)).toThrow('DrawingParticipantSecretMissing');
  });
});
