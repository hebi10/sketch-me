'use client';

import { useCallback, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import type { ModerationStatus } from '@/lib/domain/types';
import { AdminModerationDialog } from '../../AdminModerationDialog';

const genericErrorMessage = '상태를 변경하지 못했습니다. 잠시 후 다시 시도해 주세요.';

export function SketchbookModerationButton({
  moderationStatus,
  sketchbookId,
}: {
  moderationStatus: ModerationStatus;
  sketchbookId: string;
}) {
  const router = useRouter();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const processingRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isBlocked = moderationStatus === 'BLOCKED';
  const nextStatus: ModerationStatus = isBlocked ? 'ACTIVE' : 'BLOCKED';
  const triggerLabel = isBlocked ? '비활성화 해제' : '서비스에서 비활성화';
  const title = isBlocked
    ? '스케치북 비활성화를 해제할까요?'
    : '스케치북을 비활성화할까요?';
  const confirmLabel = isBlocked ? '비활성화 해제하기' : '비활성화하기';
  const description = isBlocked
    ? '해제하면 친구 공개 페이지와 그리기 기능을 다시 사용할 수 있습니다.'
    : '비활성화하면 친구 공개 페이지와 그리기 기능이 즉시 차단됩니다.';

  const close = useCallback(() => {
    if (processingRef.current) return;
    setOpen(false);
    setError(null);
  }, []);

  function showConfirmation() {
    setError(null);
    setOpen(true);
  }

  async function updateModeration() {
    if (processingRef.current) return;
    processingRef.current = true;
    setProcessing(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/admin/sketchbooks/${encodeURIComponent(sketchbookId)}/moderation`,
        {
          body: JSON.stringify({ moderationStatus: nextStatus }),
          headers: { 'Content-Type': 'application/json' },
          method: 'PATCH',
        },
      );
      if (!response.ok) {
        setError(genericErrorMessage);
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      setError(genericErrorMessage);
    } finally {
      processingRef.current = false;
      setProcessing(false);
    }
  }

  return (
    <>
      <button
        className={`button button--${isBlocked ? 'secondary' : 'danger'}`}
        onClick={showConfirmation}
        ref={triggerRef}
        type="button"
      >
        {triggerLabel}
      </button>
      <AdminModerationDialog
        confirmLabel={confirmLabel}
        description={description}
        error={error}
        onClose={close}
        onConfirm={updateModeration}
        open={open}
        pendingLabel="처리 중…"
        processing={processing}
        returnFocusRef={triggerRef}
        title={title}
      />
    </>
  );
}
