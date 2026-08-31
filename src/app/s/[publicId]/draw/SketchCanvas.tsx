'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import { SketchEditor, type SketchEditorHandle } from '@/components/sketch/SketchEditor';
import { getPublicMutationHeaders } from '@/lib/security/app-check-client';

interface SketchCanvasProps {
  publicId: string;
  sketchbookName: string;
}

export function SketchCanvas({ publicId, sketchbookName }: SketchCanvasProps) {
  const editorRef = useRef<SketchEditorHandle>(null);
  const [authorName, setAuthorName] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function navigateBack() {
    if (editorRef.current?.hasDrawing() && !window.confirm('저장하지 않은 그림이 있어요. 지금 나가면 그림이 사라집니다. 나가시겠어요?')) return;
    router.back();
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const imageDataUrl = editorRef.current?.exportDrawing();
    if (!imageDataUrl) {
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
        body: JSON.stringify({ authorName, message, imageDataUrl }),
      });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(result.message ?? '그림을 남기지 못했습니다.');
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
      <SketchEditor ariaLabel={`${sketchbookName}님을 위한 그림 캔버스`} ref={editorRef} />
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
