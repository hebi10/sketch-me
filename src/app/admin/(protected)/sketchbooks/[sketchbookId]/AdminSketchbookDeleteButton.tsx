'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import { AdminModerationDialog } from '../../AdminModerationDialog';

const genericErrorMessage = '스케치북을 완전히 삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.';

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === 'AbortError';
}

export function AdminSketchbookDeleteButton({
  name,
  publicId,
  sketchbookId,
}: {
  name: string;
  publicId: string;
  sketchbookId: string;
}) {
  const router = useRouter();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const processingRef = useRef(false);
  const requestControllerRef = useRef<AbortController | null>(null);
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const confirmed = confirmation === publicId;

  useEffect(() => () => {
    const controller = requestControllerRef.current;
    requestControllerRef.current = null;
    controller?.abort();
  }, []);

  const close = useCallback(() => {
    if (processingRef.current) return;
    setOpen(false);
    setConfirmation('');
    setError(null);
  }, []);

  function showConfirmation() {
    setConfirmation('');
    setError(null);
    setOpen(true);
  }

  async function deleteSketchbook() {
    if (!confirmed || processingRef.current) return;
    const controller = new AbortController();
    requestControllerRef.current = controller;
    processingRef.current = true;
    setProcessing(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/admin/sketchbooks/${encodeURIComponent(sketchbookId)}`,
        {
          body: JSON.stringify({ confirmation }),
          headers: { 'Content-Type': 'application/json' },
          method: 'DELETE',
          signal: controller.signal,
        },
      );
      if (controller.signal.aborted) return;
      if (!response.ok) {
        setError(genericErrorMessage);
        return;
      }
      setOpen(false);
      router.replace('/admin/sketchbooks');
      router.refresh();
    } catch (requestError) {
      if (controller.signal.aborted || isAbortError(requestError)) return;
      setError(genericErrorMessage);
    } finally {
      if (requestControllerRef.current === controller) {
        requestControllerRef.current = null;
      }
      if (!controller.signal.aborted) {
        processingRef.current = false;
        setProcessing(false);
      }
    }
  }

  return (
    <section aria-labelledby="admin-sketchbook-delete" className="admin-danger-zone">
      <div>
        <h2 id="admin-sketchbook-delete">스케치북 완전 삭제</h2>
        <p>관련 데이터와 그림 파일을 복구할 수 없게 삭제합니다.</p>
      </div>
      <button
        className="button button--danger"
        onClick={showConfirmation}
        ref={triggerRef}
        type="button"
      >
        스케치북 완전 삭제
      </button>
      <AdminModerationDialog
        closeLabel="영구 삭제 닫기"
        confirmDisabled={!confirmed}
        confirmLabel="완전히 삭제하기"
        confirmVariant="danger"
        description="생성자와 친구 그림 파일, 그림 문서, 관리 세션과 결제 기록을 포함한 모든 데이터가 영구 삭제됩니다."
        error={error}
        eyebrow={null}
        initialFocusSelector="[data-admin-delete-confirmation]"
        onClose={close}
        onConfirm={deleteSketchbook}
        open={open}
        pendingLabel="삭제 중…"
        processing={processing}
        returnFocusRef={triggerRef}
        title={`${name} 스케치북을 완전히 삭제할까요?`}
      >
        <div className="admin-delete-confirmation">
          <p>
            계속하려면 공개 ID <strong>{publicId}</strong>을(를) 아래에 그대로 입력해 주세요.
          </p>
          <label htmlFor="admin-delete-public-id">확인을 위해 공개 ID 입력</label>
          <input
            autoComplete="off"
            data-admin-delete-confirmation
            disabled={processing}
            id="admin-delete-public-id"
            onChange={(event) => setConfirmation(event.target.value)}
            spellCheck={false}
            type="text"
            value={confirmation}
          />
        </div>
      </AdminModerationDialog>
    </section>
  );
}
