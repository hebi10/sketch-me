import { NextRequest } from 'next/server';
import { unstable_doesMiddlewareMatch } from 'next/experimental/testing/server';

import { config, proxy } from '@/proxy';

function optimizerRequest(source: string) {
  return new NextRequest(`http://localhost/_next/image?url=${encodeURIComponent(source)}&w=640&q=75`);
}

describe('Next image optimizer 공개 이미지 경계', () => {
  it('Next 16 Proxy를 image optimizer 경로에만 적용한다', () => {
    expect(config).toEqual({ matcher: '/_next/image' });
    expect(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url: '/_next/image?url=%2Fbrand%2Flogo.webp&w=640&q=75' })).toBe(true);
    expect(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url: '/brand/logo.webp' })).toBe(false);
  });

  it.each([
    '/api/sketchbooks/public-1/drawings/drawing-1/image',
    'http://localhost/api/sketchbooks/public-1/owner/image',
    'https://example.com/api/sketchbooks/public-1/reference/image?download=1',
    '%2Fapi%2Fsketchbooks%2Fpublic-1%2Fdrawings%2Fdrawing-1%2Fimage',
    '%252Fapi%252Fsketchbooks%252Fpublic-1%252Fowner%252Fimage',
    '/brand/../api/sketchbooks/public-1/reference/image',
  ])('상대·절대·인코딩된 공개 API 원본 %s을 Storage 전에 no-store 404로 차단한다', (source) => {
    const response = proxy(optimizerRequest(source));

    expect(response.status).toBe(404);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  });

  it.each([
    '/brand/sketchbook-kakao-share.webp',
    '/api/sketchbooks/public-1/profile/image',
    '/api/sketchbooks/public-1/drawings/drawing-1/thumbnail',
    'https://images.example.com/photo.webp',
  ])('일반 이미지 optimizer 요청 %s은 통과시킨다', (source) => {
    const response = proxy(optimizerRequest(source));

    expect(response.status).toBe(200);
    expect(response.headers.get('x-middleware-next')).toBe('1');
  });
});
