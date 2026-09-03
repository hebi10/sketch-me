'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { SketchEditor } from '@/components/sketch/SketchEditor';
import styles from './OwnerDrawingEdit.module.css';

interface OwnerDrawingEditorProps {
  name: string;
  publicId: string;
}

export function OwnerDrawingEditor({ name, publicId }: OwnerDrawingEditorProps) {
  const router = useRouter();
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!imageDataUrl || isSaving) return;
    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/manage/${publicId}/owner/image`, {
        body: JSON.stringify({ imageDataUrl }),
        headers: { 'Content-Type': 'application/json' },
        method: 'PUT',
      });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? '그림을 저장하지 못했어요.');

      router.replace(`/m/${publicId}`);
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '그림을 저장하지 못했어요.');
      setIsSaving(false);
    }
  }

  return (
    <div className={styles.content}>
      <div className={styles.heading}>
        <h1 className={styles.headingTitle}>{name}님의 그림 수정</h1>
        <p className={styles.headingCopy}>기존 그림 위에 이어 그리거나 지우고 새로 그릴 수 있어요.</p>
      </div>
      <SketchEditor
        ariaLabel={`${name}님의 모습을 수정하는 캔버스`}
        initialDrawingDataUrl={`/api/manage/${publicId}/owner/image`}
        onDrawingChange={setImageDataUrl}
        reopenLabel="그림 편집 열기"
      />
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      <div className={styles.actions}>
        <Link className="button button--secondary" href={`/m/${publicId}`}>취소</Link>
        <button className="button button--primary" disabled={!imageDataUrl || isSaving} onClick={save} type="button">
          {isSaving ? '저장 중...' : '변경 저장하기'}
        </button>
      </div>
    </div>
  );
}
