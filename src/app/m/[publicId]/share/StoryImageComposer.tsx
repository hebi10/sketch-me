'use client';

import Image from 'next/image';
import { useState } from 'react';

import { StoryImageMaker, type StoryDrawing } from './StoryImageMaker';
import { getStoryTheme, storyThemes } from '@/lib/share/story-themes';
import { storyStyle } from '@/lib/share/story-style';

interface StoryImageComposerProps {
  drawings: StoryDrawing[];
  name: string;
  publicUrl: string;
}

export function StoryImageComposer({ drawings, name, publicUrl }: StoryImageComposerProps) {
  const [themeId, setThemeId] = useState<(typeof storyThemes)[number]['id']>(storyThemes[0].id);
  const theme = getStoryTheme(themeId);

  return (
    <>
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
        <h1>BEST 4</h1>
        <div className="story-best-grid">
          {[1, 2, 3, 4].map((rank) => {
            const drawing = drawings.find((item) => item.rank === rank);
            return (
              <figure className={`story-best-slot story-best-slot--${rank}`} key={rank}>
                <b>BEST {rank}</b>
                {drawing ? <Image alt={`BEST ${rank} 그림`} fill sizes={rank === 1 ? '420px' : '140px'} src={drawing.imageUrl} unoptimized /> : <span>아직 선정 전</span>}
              </figure>
            );
          })}
        </div>
        <div className="story-preview-cta">
          <strong>나도 스케치북에 그림 남기기</strong>
          <span>{publicUrl}</span>
        </div>
      </section>
      <p className="story-output-meta">1080 × 1440 · 3:4 공유 이미지</p>
      <StoryImageMaker backgroundImage={theme.backgroundImage} drawings={drawings} name={name} publicUrl={publicUrl} />
    </>
  );
}
