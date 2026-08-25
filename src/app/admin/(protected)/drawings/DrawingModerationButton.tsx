'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import type { ModerationStatus } from '@/lib/domain/types';
import { AdminModerationDialog } from '../AdminModerationDialog';

const genericErrorMessage = '상태를 변경하지 못했습니다. 잠시 후 다시 시도해 주세요.';

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === 'AbortError';
}

export function DrawingModerationButton({
  drawingId,
  moderationStatus,
  sketchbookId,
}: {
  drawingId: string;
  moderationStatus: ModerationStatus;
  sketchbookId: string;
}) {
  const router = useRouter();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const processingRef = useRef(false);
  const requestControllerRef = useRef<AbortController | null>(null);
  const [open, setOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isBlocked = moderationStatus === 'BLOCKED';
  const nextStatus: ModerationStatus = isBlocked ? 'ACTIVE' : 'BLOCKED';
  const triggerLabel = isBlocked ? '숨김 해제' : '서비스에서 숨기기';
  const title = isBlocked ? '그림 숨김을 해제할까요?' : '그림을 숨길까요?';
  const confirmLabel = isBlocked ? '숨김 해제하기' : '숨기기';
  const description = isBlocked
    ? '해제하면 소유자가 공개한 그림을 친구 공개 페이지와 새 Story에서 다시 사용할 수 있습니다.'
    : '숨기면 이 그림은 친구 공개 페이지와 새 Story에서 즉시 제외됩니다.';

  useEffect(() => () => {
    const controller = requestControllerRef.current;
    requestControllerRef.current = null;
    controller?.abort();
  }, []);

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
    const controller = new AbortController();
    requestControllerRef.current = controller;
    processingRef.current = true;
    setProcessing(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/admin/sketchbooks/${encodeURIComponent(sketchbookId)}/drawings/${encodeURIComponent(drawingId)}/moderation`,
        {
          body: JSON.stringify({ moderationStatus: nextStatus }),
          headers: { 'Content-Type': 'application/json' },
          method: 'PATCH',
          signal: controller.signal,
        },
      );
      if (controller.signal.aborted) return;
      if (!response.ok) {
        setError(genericErrorMessage);
        return;
      }
      setOpen(false);
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
        confirmVariant={isBlocked ? 'primary' : 'danger'}
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
