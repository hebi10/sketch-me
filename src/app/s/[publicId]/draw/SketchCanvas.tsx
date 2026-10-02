'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import { SketchEditor, type SketchEditorHandle } from '@/components/sketch/SketchEditor';
import { getPublicMutationHeaders } from '@/lib/security/app-check-client';

interface SketchCanvasProps {
  publicId: string;
  sketchbookName: string;
}

export function SketchCanvas({ publicId, sketchbookName }: SketchCanvasProps) {
  return <SketchCanvasForm key={publicId} publicId={publicId} sketchbookName={sketchbookName} />;
}

function SketchCanvasForm({ publicId, sketchbookName }: SketchCanvasProps) {
  const editorRef = useRef<SketchEditorHandle>(null);
  const draftClearedRef = useRef(false);
  const draftKey = `sketch-me:drawing-draft:${publicId}:v1`;
  const [authorName, setAuthorName] = useState('');
  const [message, setMessage] = useState('');
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [hasLoadedDraft, setHasLoadedDraft] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    let isCurrent = true;
    try {
      const saved = sessionStorage.getItem(draftKey);
      if (saved) {
        const draft: unknown = JSON.parse(saved);
        if (draft && typeof draft === 'object' && 'version' in draft && draft.version === 1) {
          queueMicrotask(() => {
            if (!isCurrent) return;
            if ('authorName' in draft && typeof draft.authorName === 'string') setAuthorName(draft.authorName);
            if ('message' in draft && typeof draft.message === 'string') setMessage(draft.message);
            if ('imageDataUrl' in draft && typeof draft.imageDataUrl === 'string' && /^data:image\/(?:png|webp|jpeg);base64,/.test(draft.imageDataUrl)) setImageDataUrl(draft.imageDataUrl);
          });
        }
      }
    } catch {
      // Session drafts are optional and must not prevent submitting a drawing.
    } finally {
      queueMicrotask(() => { if (isCurrent) setHasLoadedDraft(true); });
    }
    return () => { isCurrent = false; };
  }, [draftKey]);

  useEffect(() => {
    if (!hasLoadedDraft || draftClearedRef.current) return;
    try {
      sessionStorage.setItem(draftKey, JSON.stringify({ version: 1, authorName, message, imageDataUrl }));
    } catch {
      // Drawing and submission remain available when storage is blocked or full.
    }
  }, [authorName, draftKey, hasLoadedDraft, imageDataUrl, message]);

  function navigateBack() {
    if (editorRef.current?.hasDrawing() && !window.confirm('아직 제출하지 않은 그림이 있어요. 이전 페이지로 나가시겠어요?')) return;
    router.back();
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const drawingDataUrl = editorRef.current?.exportDrawing() ?? imageDataUrl;
    if (!drawingDataUrl) {
      setError('그림을 한 번 이상 그린 뒤 남겨주세요.');
      return;
    }
    setError(null);
    setIsSubmitting(true);

    try {
      const appCheckHeaders = await getPublicMutationHeaders();
      const response = await fetch(`/api/sketchbooks/${publicId}/drawings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...appCheckHeaders },
        body: JSON.stringify({ authorName, message, imageDataUrl: drawingDataUrl }),
      });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(result.message ?? '그림을 남기지 못했습니다.');
      draftClearedRef.current = true;
      try {
        sessionStorage.removeItem(draftKey);
      } catch {
        // A successful submission must remain successful if draft cleanup fails.
      }
      router.push(`/s/${publicId}?submitted=1`);
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : '그림을 남기지 못했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="draw-shell">
      <header className="draw-header">
        <button aria-label="이전으로" className="icon-button" onClick={navigateBack} type="button">←</button>
        <p>{sketchbookName}님을 그려주세요</p>
        <a className="draw-complete-link" href="#drawing-submit">완료</a>
      </header>
      <SketchEditor ariaLabel={`${sketchbookName}님을 위한 그림 캔버스`} initialDrawingDataUrl={imageDataUrl} onDrawingChange={setImageDataUrl} ref={editorRef} reopenLabel="그림 수정하기" />
      <form className="drawing-submit-form" id="drawing-submit" onSubmit={submit}>
        <label className="field-label" htmlFor="author-name">내 이름</label>
        <input autoComplete="name" id="author-name" maxLength={24} onChange={(event) => setAuthorName(event.target.value)} required value={authorName} />
        <label className="field-label" htmlFor="drawing-message">한마디 <span>(선택)</span></label>
        <textarea id="drawing-message" maxLength={120} onChange={(event) => setMessage(event.target.value)} rows={3} value={message} />
        {error ? <p aria-live="polite" className="form-error">{error}</p> : null}
        <button className="button button--primary" disabled={isSubmitting} type="submit">{isSubmitting ? '그림 남기는 중...' : '그림 남기기'}</button>
      </form>
    </main>
  );
}
