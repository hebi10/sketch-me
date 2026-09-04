'use client';

import Link from 'next/link';
import { useState } from 'react';

import { BestImagePreview } from './BestImagePreview';
import { DrawingPicker } from './DrawingPicker';
import { ShareImageMaker } from './ShareImageMaker';
import { SingleImagePreview } from './SingleImagePreview';
import { WatermarkPurchaseButton } from './WatermarkPurchaseButton';
import {
  SINGLE_IMAGE_DEFAULT_HEADING,
  type ShareDrawingOption,
  type ShareImageMode,
} from '@/lib/share/share-image';
import {
  STORY_SHARED_HEADING,
  STORY_SHARED_HEADING_MAX_LENGTH,
} from '@/lib/share/story-layout';
import { getStoryTheme, storyThemes } from '@/lib/share/story-themes';

interface ShareImageComposerProps {
  bestHeading?: string;
  drawings: ShareDrawingOption[];
  initialWatermarkFree: boolean;
  mode: ShareImageMode;
  name: string;
  publicId: string;
  publicUrl: string;
  singleHeading?: string;
}

export function ShareImageComposer({
  bestHeading = STORY_SHARED_HEADING,
  drawings,
  initialWatermarkFree,
  mode,
  name,
  publicId,
  publicUrl,
  singleHeading = SINGLE_IMAGE_DEFAULT_HEADING,
}: ShareImageComposerProps) {
  const initialHeading = mode === 'single' ? singleHeading : bestHeading;
  const [heading, setHeading] = useState(initialHeading);
  const [savedHeading, setSavedHeading] = useState(initialHeading);
  const [headingStatus, setHeadingStatus] = useState<string | null>(null);
  const [savingHeading, setSavingHeading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [themeId, setThemeId] = useState<(typeof storyThemes)[number]['id']>(storyThemes[0].id);
  const [watermarkFree, setWatermarkFree] = useState(initialWatermarkFree);
  const theme = getStoryTheme(themeId);
  const selectedDrawing = drawings.find((drawing) => drawing.id === selectedId) ?? null;
  const fallbackHeading = mode === 'single' ? SINGLE_IMAGE_DEFAULT_HEADING : STORY_SHARED_HEADING;
  const previewHeading = heading || fallbackHeading;

  async function saveHeading() {
    const nextHeading = heading.trim();
    if (!nextHeading) {
      setHeadingStatus('이미지 제목을 입력해 주세요.');
      return;
    }

    const key = mode === 'single' ? 'singleStoryHeading' : 'storyHeading';
    setSavingHeading(true);
    setHeadingStatus(null);
    try {
      const response = await fetch(`/api/manage/${publicId}/sketchbook`, {
        body: JSON.stringify({ [key]: nextHeading }),
        headers: { 'Content-Type': 'application/json' },
        method: 'PATCH',
      });
      const result = await response.json().catch(() => null) as Record<string, unknown> | null;
      const saved = typeof result?.[key] === 'string' ? result[key] : null;
      if (!response.ok || !saved) {
        throw new Error(typeof result?.message === 'string' ? result.message : '제목을 저장하지 못했어요.');
      }
      setHeading(saved);
      setSavedHeading(saved);
      setHeadingStatus('제목을 저장했어요.');
    } catch (error) {
      setHeadingStatus(error instanceof Error ? error.message : '제목을 저장하지 못했어요.');
    } finally {
      setSavingHeading(false);
    }
  }

  return (
    <>
      <section aria-labelledby="share-heading-label" className="story-heading-editor">
        <div className="story-heading-meta">
          <label id="share-heading-label" htmlFor="share-heading">이미지 제목</label>
          <span aria-label={`제목 ${heading.length}/${STORY_SHARED_HEADING_MAX_LENGTH}자`}>
            {heading.length}/{STORY_SHARED_HEADING_MAX_LENGTH}
          </span>
        </div>
        <div className="story-heading-row">
          <input
            id="share-heading"
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

      {mode === 'single' ? (
        <DrawingPicker drawings={drawings} onSelect={setSelectedId} selectedId={selectedId} />
      ) : (
        <div className="story-ranking-action">
          <Link className="button button--secondary" href={`/m/${publicId}#drawing-ranking`}>
            순위 정하러 가기
          </Link>
        </div>
      )}

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

      {mode === 'single' ? (
        <SingleImagePreview
          drawing={selectedDrawing}
          heading={previewHeading}
          name={name}
          themeBackgroundImage={theme.backgroundImage}
          watermarkFree={watermarkFree}
        />
      ) : (
        <BestImagePreview
          drawings={drawings}
          heading={previewHeading}
          publicUrl={publicUrl}
          themeBackgroundImage={theme.backgroundImage}
          watermarkFree={watermarkFree}
        />
      )}
      <p className="story-output-meta">
        {mode === 'single' ? '1080 × 1080 · 1:1 공유 이미지' : '1080 × 1440 · 3:4 공유 이미지'}
      </p>
      {watermarkFree ? (
        <p className="watermark-applied" role="status">워터마크 제거가 적용되어 있어요.</p>
      ) : (
        <WatermarkPurchaseButton onPurchased={() => setWatermarkFree(true)} publicId={publicId} />
      )}
      <ShareImageMaker
        backgroundImage={theme.backgroundImage}
        drawing={selectedDrawing}
        drawings={drawings}
        heading={previewHeading}
        mode={mode}
        name={name}
        publicUrl={publicUrl}
        watermarkFree={watermarkFree}
      />
    </>
  );
}
