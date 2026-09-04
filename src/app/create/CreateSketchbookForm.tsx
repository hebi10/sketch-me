'use client';

import { useEffect, useRef, useState } from 'react';

import { SketchEditor, type SketchEditorHandle } from '@/components/sketch/SketchEditor';
import { getPublicMutationHeaders } from '@/lib/security/app-check-client';
import { FREE_PARTICIPANT_LIMIT } from '@/lib/sketchbooks/capacity';
import { CreateCompleteActions } from './CreateCompleteActions';

interface CreateResult {
  manageUrl: string;
  publicUrl: string;
}

const draftKey = 'sketch-me:create-draft:v1';

interface CreateDraft {
  managePinHint: string;
  name: string;
  ownerImageDataUrl?: string;
  version: 2;
}

interface SavedCreateDraft {
  managePinHint?: unknown;
  name?: unknown;
  ownerImageDataUrl?: unknown;
  version?: unknown;
}

export function CreateSketchbookForm() {
  const editorRef = useRef<SketchEditorHandle>(null);
  const draftClearedRef = useRef(false);
  const [name, setName] = useState('');
  const [managePin, setManagePin] = useState('');
  const [managePinConfirmation, setManagePinConfirmation] = useState('');
  const [managePinHint, setManagePinHint] = useState('');
  const [ownerImageDataUrl, setOwnerImageDataUrl] = useState<string | null>(null);
  const [hasLoadedDraft, setHasLoadedDraft] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pinConfirmationError, setPinConfirmationError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [created, setCreated] = useState<CreateResult | null>(null);

  useEffect(() => {
    let isCurrent = true;
    try {
      const saved = sessionStorage.getItem(draftKey);
      if (saved) {
        const draft = JSON.parse(saved) as SavedCreateDraft;
        if (draft.version === 1 || draft.version === 2) {
          queueMicrotask(() => {
            if (!isCurrent) return;
            if (typeof draft.name === 'string') setName(draft.name);
            if (typeof draft.managePinHint === 'string') setManagePinHint(draft.managePinHint);
            if (typeof draft.ownerImageDataUrl === 'string') setOwnerImageDataUrl(draft.ownerImageDataUrl);
          });
        }
      }
    } catch {
      try {
        sessionStorage.removeItem(draftKey);
      } catch {
        // Session drafts are optional and must not block creating a sketchbook.
      }
    } finally {
      queueMicrotask(() => { if (isCurrent) setHasLoadedDraft(true); });
    }
    return () => { isCurrent = false; };
  }, []);

  useEffect(() => {
    if (!hasLoadedDraft || draftClearedRef.current) return;
    const draft: CreateDraft = { managePinHint, name, version: 2 };
    if (ownerImageDataUrl) draft.ownerImageDataUrl = ownerImageDataUrl;
    try {
      sessionStorage.setItem(draftKey, JSON.stringify(draft));
    } catch {
      // Session drafts are optional and must not block creating a sketchbook.
    }
  }, [hasLoadedDraft, managePinHint, name, ownerImageDataUrl]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!/^\d{4}$/.test(managePin)) {
      setError('관리용 비밀번호는 숫자 4자리로 입력해 주세요.');
      return;
    }
    if (managePin !== managePinConfirmation) {
      setPinConfirmationError('관리용 비밀번호가 일치하지 않아요.');
      return;
    }
    const drawingDataUrl = editorRef.current?.exportDrawing() ?? ownerImageDataUrl;
    setError(null);
    setPinConfirmationError(null);
    setIsSubmitting(true);

    try {
      const appCheckHeaders = await getPublicMutationHeaders();
      const response = await fetch('/api/sketchbooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...appCheckHeaders },
        body: JSON.stringify({ name, managePin, managePinHint: managePinHint || undefined, ownerImageDataUrl: drawingDataUrl ?? undefined }),
      });
      const data = (await response.json()) as Partial<CreateResult> & { message?: string };
      if (!response.ok || !data.manageUrl || !data.publicUrl) throw new Error(data.message ?? '스캐치북을 만들지 못했습니다. 잠시 후 다시 시도해 주세요.');
      draftClearedRef.current = true;
      try {
        sessionStorage.removeItem(draftKey);
      } catch {
        // The completed sketchbook remains available even when draft cleanup fails.
      }
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
        <p>다른 기기에서는 방금 만든 숫자 4자리 관리용 비밀번호로 접속할 수 있어요. 비밀번호는 복구할 수 없어요.</p>
        <CreateCompleteActions manageUrl={created.manageUrl} publicUrl={created.publicUrl} />
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
        <label className="field-label" htmlFor="manage-pin">관리용 비밀번호</label>
        <input autoComplete="new-password" id="manage-pin" inputMode="numeric" maxLength={4} name="manage-pin" onChange={(event) => { event.currentTarget.setCustomValidity(''); setManagePin(event.target.value.replace(/\D/g, '')); setPinConfirmationError(null); }} onInvalid={(event) => { event.currentTarget.setCustomValidity('관리용 비밀번호는 숫자 4자리로 입력해 주세요.'); setError('관리용 비밀번호는 숫자 4자리로 입력해 주세요.'); }} pattern="[0-9]{4}" placeholder="숫자 4자리" required type="password" value={managePin} />
        <label className="field-label" htmlFor="manage-pin-confirmation">관리용 비밀번호 확인</label>
        <input aria-describedby={pinConfirmationError ? 'manage-pin-confirmation-error' : undefined} aria-invalid={pinConfirmationError ? true : undefined} autoComplete="new-password" id="manage-pin-confirmation" inputMode="numeric" maxLength={4} name="manage-pin-confirmation" onChange={(event) => setManagePinConfirmation(event.target.value.replace(/\D/g, ''))} pattern="[0-9]{4}" placeholder="숫자 4자리 다시 입력" required type="password" value={managePinConfirmation} />
        {pinConfirmationError ? <p className="form-error" id="manage-pin-confirmation-error" role="alert">{pinConfirmationError}</p> : null}
        <label className="field-label" htmlFor="manage-pin-hint">비밀번호 힌트 <span className="optional-label">(선택)</span></label>
        <input id="manage-pin-hint" maxLength={40} name="manage-pin-hint" onChange={(event) => setManagePinHint(event.target.value)} placeholder="예: 좋아하는 숫자" value={managePinHint} />
        <p className="field-hint">관리용 비밀번호는 복구할 수 없어요.</p>
      </section>

      <section aria-labelledby="owner-sketch-title">
        <div className="section-heading"><h2 id="owner-sketch-title">내가 그린 나 <span className="optional-label">선택</span></h2><p>그리지 않아도 스캐치북을 만들 수 있어요.</p></div>
        <SketchEditor ariaLabel="내 모습을 그리는 캔버스" initialDrawingDataUrl={ownerImageDataUrl} onDrawingChange={setOwnerImageDataUrl} ref={editorRef} />
      </section>

      {error ? <p className="form-error" role="alert">{error}</p> : null}
      <button className="button button--primary create-submit" disabled={isSubmitting} type="submit">{isSubmitting ? '스캐치북 만드는 중...' : '내 스캐치북 만들기'}</button>
      <p className="field-hint">친구 그림 {FREE_PARTICIPANT_LIMIT}개까지 무료로 받아볼 수 있어요.</p>
    </form>
  );
}
