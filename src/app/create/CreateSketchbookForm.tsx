'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import { SketchEditor, type SketchEditorHandle } from '@/components/sketch/SketchEditor';

interface CreateResult {
  manageUrl: string;
  publicUrl: string;
  recoveryUrl: string;
}

export function CreateSketchbookForm() {
  const editorRef = useRef<SketchEditorHandle>(null);
  const router = useRouter();
  const [name, setName] = useState('');
  const [referenceImageDataUrl, setReferenceImageDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [created, setCreated] = useState<CreateResult | null>(null);

  function selectReference(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('JPG, PNG, WEBP 참고 사진만 선택할 수 있어요.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('참고 사진은 2MB 이하로 선택해 주세요.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setReferenceImageDataUrl(typeof reader.result === 'string' ? reader.result : null);
      setError(null);
    };
    reader.onerror = () => setError('참고 사진을 읽지 못했습니다. 다른 사진을 선택해 주세요.');
    reader.readAsDataURL(file);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const ownerImageDataUrl = editorRef.current?.exportDrawing();
    if (!ownerImageDataUrl) {
      setError('나를 표현한 그림을 한 번 이상 그려주세요.');
      return;
    }
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/sketchbooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, ownerImageDataUrl, referenceImageDataUrl: referenceImageDataUrl ?? undefined }),
      });
      const data = (await response.json()) as Partial<CreateResult> & { message?: string };
      if (!response.ok || !data.manageUrl || !data.publicUrl || !data.recoveryUrl) throw new Error(data.message ?? '스캐치북을 만들지 못했습니다. 잠시 후 다시 시도해 주세요.');
      setCreated(data as CreateResult);
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : '스캐치북을 만들지 못했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (created) {
    const recoveryUrl = typeof window === 'undefined' ? created.recoveryUrl : `${window.location.origin}${created.recoveryUrl}`;
    return (
      <section className="create-complete" aria-labelledby="create-complete-title">
        <p className="eyebrow">스캐치북 완성</p>
        <h1 id="create-complete-title">관리 복구 링크를 보관해 주세요</h1>
        <p>쿠키가 사라지거나 다른 기기에서 관리할 때 필요한 링크예요. 이 화면을 닫으면 다시 표시되지 않습니다.</p>
        <label className="field-label" htmlFor="recovery-url">관리 복구 링크</label>
        <input id="recovery-url" readOnly value={recoveryUrl} />
        <button className="button button--secondary" onClick={() => navigator.clipboard.writeText(recoveryUrl)} type="button">복구 링크 복사</button>
        <button className="button button--primary" onClick={() => router.push(created.manageUrl)} type="button">내 스캐치북 관리하기</button>
      </section>
    );
  }

  return (
    <form className="create-flow" onSubmit={handleSubmit}>
      <section className="create-intro" aria-labelledby="create-title">
        <p className="eyebrow">새 스캐치북</p>
        <h1 id="create-title">내 스캐치북 만들기</h1>
        <p>친구들이 부를 이름과, 내가 생각하는 내 모습을 남겨주세요.</p>
        <label className="field-label" htmlFor="sketchbook-name">이름 또는 애칭</label>
        <input autoComplete="nickname" id="sketchbook-name" maxLength={24} name="name" onChange={(event) => setName(event.target.value)} placeholder="내 이름" required value={name} />
      </section>

      <section className="reference-picker" aria-labelledby="reference-title">
        <div><h2 id="reference-title">참고 사진</h2><p>선택 사항이에요. 친구가 그릴 때만 참고할 수 있어요.</p></div>
        <label className="button button--secondary" htmlFor="reference-image">{referenceImageDataUrl ? '다른 사진 선택' : '사진 선택하기'}</label>
        <input accept="image/jpeg,image/png,image/webp" id="reference-image" onChange={selectReference} type="file" />
        {referenceImageDataUrl ? <button className="button button--text" onClick={() => setReferenceImageDataUrl(null)} type="button">참고 사진 제거</button> : null}
      </section>

      <section aria-labelledby="owner-sketch-title">
        <div className="section-heading"><h2 id="owner-sketch-title">내가 그린 나</h2><p>참고 사진은 저장되는 그림에 포함되지 않아요.</p></div>
        <SketchEditor ariaLabel="내 모습을 그리는 캔버스" ref={editorRef} referenceImageUrl={referenceImageDataUrl} />
      </section>

      {error ? <p aria-live="polite" className="form-error">{error}</p> : null}
      <button className="button button--primary create-submit" disabled={isSubmitting} type="submit">{isSubmitting ? '스캐치북 만드는 중...' : '내 스캐치북 만들기'}</button>
      <p className="field-hint">친구 그림 20개까지 무료로 받아볼 수 있어요.</p>
    </form>
  );
}
