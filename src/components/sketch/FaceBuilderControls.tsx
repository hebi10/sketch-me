'use client';

import Image from 'next/image';
import { useState } from 'react';

import {
  FACE_PARTS,
  selectFacePart,
  selectedFacePartSources,
  type FacePartCategory,
  type FaceSelection,
} from './face-parts';

const categoryLabels: Record<FacePartCategory, string> = {
  accessory: '소품',
  eyes: '눈',
  face: '얼굴',
  hair: '머리',
  mouth: '입',
};

const categories = Object.keys(categoryLabels) as FacePartCategory[];

interface FaceBuilderControlsProps {
  crosshairVisible: boolean;
  failedSources: ReadonlySet<string>;
  loadingSources: ReadonlySet<string>;
  onClear: () => void;
  onCrosshairChange: (visible: boolean) => void;
  onRandomize: () => void;
  onRetry: (source: string) => void;
  onSelect: (category: FacePartCategory, id: string) => void;
  onStartDrawing: () => void;
  selection: FaceSelection;
}

export function FaceBuilderControls({
  crosshairVisible,
  failedSources,
  loadingSources,
  onClear,
  onCrosshairChange,
  onRandomize,
  onRetry,
  onSelect,
  onStartDrawing,
  selection,
}: FaceBuilderControlsProps) {
  const [activeCategory, setActiveCategory] = useState<FacePartCategory>('face');

  return (
    <div className="face-builder-controls">
      <div aria-label="얼굴 파츠 종류" className="face-category-tabs" role="tablist">
        {categories.map((category) => (
          <button
            aria-controls={`face-part-panel-${category}`}
            aria-selected={activeCategory === category}
            id={`face-part-tab-${category}`}
            key={category}
            onClick={() => setActiveCategory(category)}
            role="tab"
            type="button"
          >
            {categoryLabels[category]}
          </button>
        ))}
      </div>

      <ul
        aria-labelledby={`face-part-tab-${activeCategory}`}
        className="face-part-grid"
        id={`face-part-panel-${activeCategory}`}
        role="tabpanel"
      >
        {FACE_PARTS[activeCategory].map((option) => {
          const selected = selection[activeCategory] === option.id;
          const loading = loadingSources.has(option.src);
          const failed = failedSources.has(option.src);
          const previewSelection = selectFacePart(selection, activeCategory, option.id);
          const previewSources = selectedFacePartSources(previewSelection);
          return (
            <li aria-label={failed ? `${option.label} 오류` : undefined} key={option.id}>
              <button
                aria-label={loading ? `${option.label} 불러오는 중` : option.label}
                aria-pressed={selected}
                className="face-part-option"
                disabled={loading || failed}
                onClick={() => onSelect(activeCategory, option.id)}
                type="button"
              >
                <span aria-hidden="true" className="face-part-preview">
                  {previewSources.map((source) => (
                    <Image alt="" height={720} key={source} src={source} width={720} />
                  ))}
                </span>
                <span>{option.label}</span>
                {selected ? <span className="sr-only">선택됨</span> : null}
                {loading ? <span className="face-part-status">불러오는 중</span> : null}
              </button>
              {failed ? (
                <button className="face-part-retry" onClick={() => onRetry(option.src)} type="button">
                  다시 시도
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>

      <label className="crosshair-toggle">
        <input
          checked={crosshairVisible}
          onChange={(event) => onCrosshairChange(event.target.checked)}
          type="checkbox"
        />
        <span>중앙선 보기</span>
      </label>

      <div className="face-builder-actions">
        <button className="tool-button" onClick={onRandomize} type="button">랜덤 조합</button>
        <button className="tool-button" onClick={onClear} type="button">얼굴 초기화</button>
        <button className="button button--primary" onClick={onStartDrawing} type="button">이 얼굴로 시작하기</button>
      </div>
    </div>
  );
}
