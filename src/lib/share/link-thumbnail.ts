import type { Drawing, Sketchbook } from '@/lib/domain/types';

export interface LinkShareThumbnail {
  alt: string;
  height: number;
  previewVersion: string | null;
  url: string;
  width: number;
}

const defaultThumbnail: LinkShareThumbnail = {
  alt: '스캐치북',
  height: 630,
  previewVersion: null,
  url: '/brand/sketchbook-kakao-share.webp',
  width: 1200,
};

export function resolveLinkShareThumbnail(
  sketchbook: Sketchbook,
  bestDrawing: Drawing | null = null,
): LinkShareThumbnail {
  if (sketchbook.shareThumbnailMode === 'OWNER' && sketchbook.ownerDrawingPath) {
    const version = sketchbook.updatedAt.getTime().toString(36);
    return {
      alt: `${sketchbook.name}님이 직접 그린 모습`,
      height: 630,
      previewVersion: `owner-${version}`,
      url: `/api/sketchbooks/${sketchbook.publicId}/owner/image?v=${version}&share=1`,
      width: 1200,
    };
  }

  if (
    sketchbook.shareThumbnailMode === 'BEST_1'
    && bestDrawing?.bestRank === 1
    && bestDrawing.status === 'VISIBLE'
    && bestDrawing.moderationStatus === 'ACTIVE'
  ) {
    return {
      alt: `BEST 1, ${bestDrawing.authorName}님의 그림`,
      height: 630,
      previewVersion: `${bestDrawing.id}-${bestDrawing.publicImageVersion}`,
      url: `/api/sketchbooks/${sketchbook.publicId}/drawings/${bestDrawing.id}/thumbnail?v=${encodeURIComponent(bestDrawing.publicImageVersion)}&share=1`,
      width: 1200,
    };
  }

  return {
    ...defaultThumbnail,
    alt: `${sketchbook.name}님의 스캐치북`,
    previewVersion: `default-${sketchbook.updatedAt.getTime().toString(36)}`,
  };
}
