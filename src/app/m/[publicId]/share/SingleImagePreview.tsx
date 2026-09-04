import Image from 'next/image';

import type { ShareDrawingOption } from '@/lib/share/share-image';
import { SINGLE_IMAGE_LAYOUT } from '@/lib/share/single-image-layout';
import { storyStyle } from '@/lib/share/story-style';

interface SingleImagePreviewProps {
  drawing: ShareDrawingOption | null;
  heading: string;
  name: string;
  themeBackgroundImage: string;
  watermarkFree: boolean;
}

export function SingleImagePreview({
  drawing,
  heading,
  name,
  themeBackgroundImage,
  watermarkFree,
}: SingleImagePreviewProps) {
  const author = drawing?.source === 'owner'
    ? `${name} · 내 그림`
    : drawing
      ? `그린 사람 · ${drawing.authorName}`
      : null;

  return (
    <section
      aria-label="정사각형 공유 이미지 미리보기"
      className="single-image-preview"
      style={{
        backgroundColor: storyStyle.background,
        backgroundImage: `url(${themeBackgroundImage})`,
      }}
    >
      <p className="single-image-preview__heading">{heading}</p>
      <figure
        className="single-image-preview__frame"
        style={{
          height: `${(SINGLE_IMAGE_LAYOUT.frame.height / SINGLE_IMAGE_LAYOUT.height) * 100}%`,
          left: `${(SINGLE_IMAGE_LAYOUT.frame.x / SINGLE_IMAGE_LAYOUT.width) * 100}%`,
          top: `${(SINGLE_IMAGE_LAYOUT.frame.y / SINGLE_IMAGE_LAYOUT.height) * 100}%`,
          width: `${(SINGLE_IMAGE_LAYOUT.frame.width / SINGLE_IMAGE_LAYOUT.width) * 100}%`,
        }}
      >
        {drawing ? (
          <Image
            alt={drawing.source === 'owner' ? '직접 그린 내 모습' : `${drawing.authorName}님의 그림`}
            fill
            sizes="468px"
            src={drawing.imageUrl}
            unoptimized
          />
        ) : <span>그림을 선택해 주세요</span>}
      </figure>
      {author ? <p className="single-image-preview__author">{author}</p> : null}
      {!watermarkFree ? (
        <div className="single-image-preview__watermark">
          <Image alt="스캐치북 워터마크" height={30} src="/brand/sketchbook-watermark.webp" unoptimized width={30} />
          <span>스캐치북</span>
        </div>
      ) : null}
    </section>
  );
}
