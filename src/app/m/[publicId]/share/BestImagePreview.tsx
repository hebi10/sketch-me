import Image from 'next/image';

import { SHARE_IMAGE_WATERMARK_TEXT, type ShareDrawingOption } from '@/lib/share/share-image';
import {
  STORY_HEIGHT,
  STORY_PUBLIC_URL_Y,
  STORY_WIDTH,
  storySlots,
  storyWatermark,
} from '@/lib/share/story-layout';
import { storyStyle } from '@/lib/share/story-style';

interface BestImagePreviewProps {
  drawings: ShareDrawingOption[];
  heading: string;
  publicUrl: string;
  themeBackgroundImage: string;
  watermarkFree: boolean;
}

export function BestImagePreview({
  drawings,
  heading,
  publicUrl,
  themeBackgroundImage,
  watermarkFree,
}: BestImagePreviewProps) {
  return (
    <section
      aria-label="BEST 공유 이미지 미리보기"
      className="story-preview"
      style={{
        backgroundColor: storyStyle.background,
        backgroundImage: `url(${themeBackgroundImage})`,
      }}
    >
      <p className="story-preview__heading">{heading}</p>
      <h1>BEST 4</h1>
      <div className="story-best-grid">
        {storySlots.map((slot) => {
          const drawing = drawings.find((item) => item.bestRank === slot.rank);
          return (
            <figure
              className={`story-best-slot story-best-slot--${slot.rank}`}
              key={slot.rank}
              style={{
                height: `${(slot.height / STORY_HEIGHT) * 100}%`,
                left: `${(slot.x / STORY_WIDTH) * 100}%`,
                top: `${(slot.y / STORY_HEIGHT) * 100}%`,
                width: `${(slot.width / STORY_WIDTH) * 100}%`,
              }}
            >
              <b>BEST {slot.rank}</b>
              {drawing ? (
                <Image
                  alt={`BEST ${slot.rank} 그림`}
                  fill
                  sizes={slot.rank === 1 ? '440px' : '160px'}
                  src={drawing.imageUrl}
                  unoptimized
                />
              ) : <span>아직 선정 전</span>}
            </figure>
          );
        })}
      </div>
      <span
        className="story-preview-public-url"
        style={{ top: `${(STORY_PUBLIC_URL_Y / STORY_HEIGHT) * 100}%` }}
      >
        {publicUrl}
      </span>
      {!watermarkFree ? (
        <div
          className="story-watermark"
          style={{
            height: `${(storyWatermark.height / STORY_HEIGHT) * 100}%`,
            left: '50%',
            opacity: storyWatermark.opacity,
            top: '65%',
            transform: 'translateX(-50%)',
            width: '50%',
          }}
        >
          <Image alt="스캐치북 워터마크" height={30} src="/brand/sketchbook-watermark.webp" unoptimized width={30} />
          <span>{SHARE_IMAGE_WATERMARK_TEXT}</span>
        </div>
      ) : null}
    </section>
  );
}
