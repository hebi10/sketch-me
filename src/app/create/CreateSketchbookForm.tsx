'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import { SketchEditor, type SketchEditorHandle } from '@/components/sketch/SketchEditor';

interface CreateResult {
  manageUrl: string;
  publicUrl: string;
}

export function CreateSketchbookForm() {
  const editorRef = useRef<SketchEditorHandle>(null);
  const router = useRouter();
  const [name, setName] = useState('');
  const [managePin, setManagePin] = useState('');
  const [managePinHint, setManagePinHint] = useState('');
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
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/sketchbooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, managePin, managePinHint: managePinHint || undefined, ownerImageDataUrl: ownerImageDataUrl ?? undefined, referenceImageDataUrl: referenceImageDataUrl ?? undefined }),
      });
      const data = (await response.json()) as Partial<CreateResult> & { message?: string };
      if (!response.ok || !data.manageUrl || !data.publicUrl) throw new Error(data.message ?? '스캐치북을 만들지 못했습니다. 잠시 후 다시 시도해 주세요.');
      setCreated(data as CreateResult);
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : '스캐치북을 만들지 못했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (created) {
    return (
      <section className="create-complete" aria-labelledby="create-complete-title">
        <p className="eyebrow">스캐치북 완성</p>
        <h1 id="create-complete-title">스캐치북이 완성됐어요</h1>
        <p>다른 기기에서는 방금 만든 숫자 4자리 관리 비밀번호로 접속할 수 있어요. 비밀번호는 복구할 수 없어요.</p>
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
        <label className="field-label" htmlFor="manage-pin">관리 비밀번호</label>
        <input autoComplete="new-password" id="manage-pin" inputMode="numeric" maxLength={4} name="manage-pin" onChange={(event) => setManagePin(event.target.value.replace(/\D/g, ''))} pattern="[0-9]{4}" placeholder="숫자 4자리" required type="password" value={managePin} />
        <label className="field-label" htmlFor="manage-pin-hint">비밀번호 힌트 <span className="optional-label">선택</span></label>
        <input id="manage-pin-hint" maxLength={40} name="manage-pin-hint" onChange={(event) => setManagePinHint(event.target.value)} placeholder="예: 좋아하는 숫자" value={managePinHint} />
        <p className="field-hint">관리 비밀번호는 복구할 수 없어요.</p>
      </section>

      <section className="reference-picker" aria-labelledby="reference-title">
        <div><h2 id="reference-title">참고 사진</h2><p>선택 사항이에요. 친구가 그릴 때만 참고할 수 있어요.</p></div>
        <label className="button button--secondary" htmlFor="reference-image">{referenceImageDataUrl ? '다른 사진 선택' : '사진 선택하기'}</label>
        <input accept="image/jpeg,image/png,image/webp" id="reference-image" onChange={selectReference} type="file" />
        {referenceImageDataUrl ? <button className="button button--text" onClick={() => setReferenceImageDataUrl(null)} type="button">참고 사진 제거</button> : null}
      </section>

      <section aria-labelledby="owner-sketch-title">
        <div className="section-heading"><h2 id="owner-sketch-title">내가 그린 나 <span className="optional-label">선택</span></h2><p>그리지 않아도 스캐치북을 만들 수 있어요. 참고 사진은 저장되는 그림에 포함되지 않아요.</p></div>
        <SketchEditor ariaLabel="내 모습을 그리는 캔버스" ref={editorRef} referenceImageUrl={referenceImageDataUrl} />
      </section>

      {error ? <p aria-live="polite" className="form-error">{error}</p> : null}
      <button className="button button--primary create-submit" disabled={isSubmitting} type="submit">{isSubmitting ? '스캐치북 만드는 중...' : '내 스캐치북 만들기'}</button>
      <p className="field-hint">친구 그림 20개까지 무료로 받아볼 수 있어요.</p>
    </form>
  );
}
