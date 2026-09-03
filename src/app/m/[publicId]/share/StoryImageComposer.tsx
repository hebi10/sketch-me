'use client';

import Image from 'next/image';
import { useState } from 'react';

import { StoryImageMaker, type StoryDrawing } from './StoryImageMaker';
import { WatermarkPurchaseButton } from './WatermarkPurchaseButton';
import {
  STORY_CTA_Y,
  STORY_HEIGHT,
  STORY_SHARED_HEADING,
  STORY_SHARED_HEADING_MAX_LENGTH,
  STORY_WIDTH,
  storySlots,
  storyWatermark,
} from '@/lib/share/story-layout';
import { getStoryTheme, storyThemes } from '@/lib/share/story-themes';
import { storyStyle } from '@/lib/share/story-style';

interface StoryImageComposerProps {
  drawings: StoryDrawing[];
  initialHeading?: string;
  initialWatermarkFree: boolean;
  name: string;
  publicId: string;
  publicUrl: string;
}

export function StoryImageComposer({
  drawings,
  initialHeading = STORY_SHARED_HEADING,
  initialWatermarkFree,
  name,
  publicId,
  publicUrl,
}: StoryImageComposerProps) {
  const [heading, setHeading] = useState(initialHeading);
  const [savedHeading, setSavedHeading] = useState(initialHeading);
  const [headingStatus, setHeadingStatus] = useState<string | null>(null);
  const [savingHeading, setSavingHeading] = useState(false);
  const [themeId, setThemeId] = useState<(typeof storyThemes)[number]['id']>(storyThemes[0].id);
  const [watermarkFree, setWatermarkFree] = useState(initialWatermarkFree);
  const theme = getStoryTheme(themeId);

  async function saveHeading() {
    const storyHeading = heading.trim();
    if (!storyHeading) {
      setHeadingStatus('이미지 제목을 입력해 주세요.');
      return;
    }

    setSavingHeading(true);
    setHeadingStatus(null);
    try {
      const response = await fetch(`/api/manage/${publicId}/sketchbook`, {
        body: JSON.stringify({ storyHeading }),
        headers: { 'Content-Type': 'application/json' },
        method: 'PATCH',
      });
      const result = await response.json().catch(() => null) as { message?: string; storyHeading?: string } | null;
      if (!response.ok || !result?.storyHeading) {
        throw new Error(result?.message ?? '제목을 저장하지 못했어요.');
      }
      setHeading(result.storyHeading);
      setSavedHeading(result.storyHeading);
      setHeadingStatus('제목을 저장했어요.');
    } catch (error) {
      setHeadingStatus(error instanceof Error ? error.message : '제목을 저장하지 못했어요.');
    } finally {
      setSavingHeading(false);
    }
  }

  return (
    <>
      <section aria-labelledby="story-heading-label" className="story-heading-editor">
        <div className="story-heading-meta">
          <label id="story-heading-label" htmlFor="story-heading">이미지 제목</label>
          <span aria-label={`제목 ${heading.length}/${STORY_SHARED_HEADING_MAX_LENGTH}자`}>{heading.length}/{STORY_SHARED_HEADING_MAX_LENGTH}</span>
        </div>
        <div className="story-heading-row">
          <input
            id="story-heading"
            maxLength={STORY_SHARED_HEADING_MAX_LENGTH}
            onChange={(event) => {
              setHeading(event.target.value);
              setHeadingStatus(null);
            }}
            value={heading}
          />
          <button
            aria-label="제목 저장하기"
            className="button button--secondary"
            disabled={savingHeading || !heading.trim() || heading.trim() === savedHeading}
            onClick={saveHeading}
            type="button"
          >
            {savingHeading ? '저장 중' : '저장'}
          </button>
        </div>
        {headingStatus ? <p aria-live="polite">{headingStatus}</p> : null}
      </section>

      <fieldset className="story-theme-picker">
        <legend>공유 이미지 디자인</legend>
        <div className="story-theme-options">
          {storyThemes.map((option) => (
            <button
              aria-pressed={option.id === theme.id}
              className="story-theme-option"
              key={option.id}
              onClick={() => setThemeId(option.id)}
              type="button"
            >
              <span aria-hidden="true" className="story-theme-thumbnail" style={{ backgroundImage: `url(${option.backgroundImage})` }} />
              <span>{option.label}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <section
        aria-label="스토리 이미지 미리보기"
        className="story-preview"
        style={{
          backgroundColor: storyStyle.background,
          backgroundImage: `url(${theme.backgroundImage})`,
        }}
      >
        <p className="story-preview__heading">{heading || STORY_SHARED_HEADING}</p>
        <h1>BEST 4</h1>
        <div className="story-best-grid">
          {storySlots.map((slot) => {
            const drawing = drawings.find((item) => item.rank === slot.rank);
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
                {drawing ? <Image alt={`BEST ${slot.rank} 그림`} fill sizes={slot.rank === 1 ? '440px' : '160px'} src={drawing.imageUrl} unoptimized /> : <span>아직 선정 전</span>}
              </figure>
            );
          })}
        </div>
        <div className="story-preview-cta" style={{ top: `${(STORY_CTA_Y / STORY_HEIGHT) * 100}%` }}>
          <strong>나도 스케치북에 그림 남기기</strong>
          <span>{publicUrl}</span>
        </div>
        {!watermarkFree ? (
          <div
            className="story-watermark"
            style={{
              height: `${(storyWatermark.height / STORY_HEIGHT) * 100}%`,
              left: `50%`,
              transform: `translateX(-50%)`,
              opacity: storyWatermark.opacity,
              top: `65%`,
              width: `50%`,
            }}
          >
            <Image alt="스캐치북 워터마크" height={30} src="/brand/sketchbook-watermark.webp" unoptimized width={30} />
            <span>https://sketch.msgnote.kr/</span>
          </div>
        ) : null}
      </section>
      <p className="story-output-meta">1080 × 1440 · 3:4 공유 이미지</p>
      {watermarkFree ? (
        <p className="watermark-applied" role="status">워터마크 제거가 적용되어 있어요.</p>
      ) : (
        <WatermarkPurchaseButton onPurchased={() => setWatermarkFree(true)} publicId={publicId} />
      )}
      <StoryImageMaker backgroundImage={theme.backgroundImage} drawings={drawings} heading={heading || STORY_SHARED_HEADING} name={name} publicUrl={publicUrl} watermarkFree={watermarkFree} />
    </>
  );
}
