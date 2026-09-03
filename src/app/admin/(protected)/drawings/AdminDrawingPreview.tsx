'use client';

import Image from 'next/image';
import { useId, useState } from 'react';

export function AdminDrawingPreview({
  alt,
  src,
}: {
  alt: string;
  src: string;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const previewId = useId();

  return (
    <div className="admin-drawing-disclosure">
      <button
        aria-controls={previewId}
        aria-expanded={isExpanded}
        className="button button--secondary"
        onClick={() => setIsExpanded((expanded) => !expanded)}
        type="button"
      >
        {isExpanded ? '그림 접기' : '그림 펼치기'}
      </button>
      <div hidden={!isExpanded} id={previewId}>
        {isExpanded ? (
          <figure className="admin-drawing-preview">
            <Image
              alt={alt}
              height={600}
              loading="lazy"
              sizes="(max-width: 650px) calc(100vw - 48px), 602px"
              src={src}
              unoptimized
              width={600}
            />
          </figure>
        ) : null}
      </div>
    </div>
  );
}
