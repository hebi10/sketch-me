'use client';

import Image from 'next/image';
import { useState } from 'react';

import {
  filterShareDrawings,
  type ShareDrawingOption,
} from '@/lib/share/share-image';
import { formatTimeAgo } from '@/lib/time/time-ago';

interface DrawingPickerProps {
  drawings: ShareDrawingOption[];
  onSelect: (drawingId: string) => void;
  selectedId: string | null;
}

function DrawingOptionButton({
  drawing,
  onSelect,
  selected,
}: {
  drawing: ShareDrawingOption;
  onSelect: (drawingId: string) => void;
  selected: boolean;
}) {
  const authorLabel = drawing.source === 'owner' ? '내 그림' : drawing.authorName;
  const timeLabel = drawing.createdAt ? formatTimeAgo(new Date(drawing.createdAt)) : '직접 그린 내 모습';
  return (
    <button
      aria-label={drawing.source === 'owner' ? '내 그림 선택' : `${drawing.authorName}님의 그림 선택`}
      aria-pressed={selected}
      className="drawing-picker-option"
      onClick={() => onSelect(drawing.id)}
      type="button"
    >
      <Image
        alt={drawing.source === 'owner' ? '직접 그린 내 모습' : `${drawing.authorName}님의 그림`}
        height={255}
        src={drawing.imageUrl}
        unoptimized
        width={255}
      />
      <span className="drawing-picker-option-meta">
        <strong>{authorLabel}</strong>
        <small>{timeLabel}</small>
      </span>
      {selected ? <span className="drawing-picker-selected">✓ 선택됨</span> : null}
    </button>
  );
}

export function DrawingPicker({ drawings, onSelect, selectedId }: DrawingPickerProps) {
  const [query, setQuery] = useState('');
  const owner = drawings.find((drawing) => drawing.source === 'owner') ?? null;
  const selected = drawings.find((drawing) => drawing.id === selectedId) ?? null;
  const results = filterShareDrawings(drawings, query);
  const normalizedDisplayQuery = query.trim();

  return (
    <section aria-labelledby="drawing-picker-title" className="drawing-picker">
      <div className="drawing-picker-heading">
        <h2 id="drawing-picker-title">그림 선택</h2>
        <p>한 장으로 만들 그림을 골라 주세요.</p>
      </div>

      {selected ? (
        <div aria-label="현재 선택한 그림" className="drawing-picker-current" role="region">
          <h3>현재 선택</h3>
          <DrawingOptionButton drawing={selected} onSelect={onSelect} selected />
        </div>
      ) : null}

      {owner && owner.id !== selectedId ? (
        <div className="drawing-picker-owner">
          <h3>내 그림</h3>
          <DrawingOptionButton drawing={owner} onSelect={onSelect} selected={false} />
        </div>
      ) : null}

      <div className="drawing-picker-search">
        <label htmlFor="drawing-author-search">그린 사람 이름</label>
        <input
          id="drawing-author-search"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="그린 사람 이름을 입력해 주세요"
          type="search"
          value={query}
        />
      </div>

      {!normalizedDisplayQuery ? (
        <p className="drawing-picker-help">이름을 입력하면 공개된 그림을 찾아드려요.</p>
      ) : results.length > 0 ? (
        <div aria-label="그림 검색 결과" className="drawing-picker-results" role="region">
          {results.map((drawing) => (
            <DrawingOptionButton
              drawing={drawing}
              key={drawing.id}
              onSelect={onSelect}
              selected={drawing.id === selectedId}
            />
          ))}
        </div>
      ) : (
        <p className="drawing-picker-empty">{normalizedDisplayQuery} 이름으로 공개된 그림을 찾지 못했어요.</p>
      )}
    </section>
  );
}
