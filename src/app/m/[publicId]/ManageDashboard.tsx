'use client';

import Image, { type ImageProps } from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { HeaderMenu } from '@/components/ui/HeaderMenu';
import { PaymentSuccessDialog } from '@/components/ui/PaymentSuccessDialog';
import type { Drawing, ModerationStatus, PurchaseProductId, ShareThumbnailMode, SketchbookEntitlements } from '@/lib/domain/types';
import { getPurchasePlan, purchasePlans } from '@/lib/purchases/plans';
import { ShareSketchbookButton } from './ShareSketchbookButton';

interface ManageDashboardProps {
  publicId: string;
  name: string;
  moderationStatus: ModerationStatus;
  ownerBestRank?: Drawing['bestRank'];
  ownerDrawingPath?: string | null;
  participantCount: number;
  participantLimit: number;
  drawings: Drawing[];
  entitlements?: SketchbookEntitlements;
  shareThumbnailMode?: ShareThumbnailMode | null;
  shareThumbnailVersion?: string | null;
}

function ManageImage({ alt, className, onError, onLoad, ...props }: ImageProps) {
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading');
  const imageClassName = [className, 'managed-image', `managed-image--${status}`].filter(Boolean).join(' ');

  return (
    <>
      {status === 'loading' ? (
        <span aria-label="그림 불러오는 중" className="managed-image-state" role="status">
          <span aria-hidden className="managed-image-loading-line" />
          <span>그림 불러오는 중…</span>
        </span>
      ) : null}
      {status === 'error' ? <span className="managed-image-state" role="alert">그림을 불러오지 못했어요.</span> : null}
      <Image
        {...props}
        alt={alt}
        className={imageClassName}
        onError={(event) => {
          setStatus('error');
          onError?.(event);
        }}
        onLoad={(event) => {
          setStatus('loaded');
          onLoad?.(event);
        }}
      />
    </>
  );
}

export function ManageDashboard({ publicId, name, moderationStatus, ownerBestRank = null, ownerDrawingPath = null, participantCount, participantLimit, drawings, entitlements: initialEntitlements = { watermarkFree: false }, shareThumbnailMode: initialShareThumbnailMode = 'DEFAULT', shareThumbnailVersion: initialShareThumbnailVersion = null }: ManageDashboardProps) {
  const router = useRouter();
  const [limit, setLimit] = useState(participantLimit);
  const [entitlements, setEntitlements] = useState(initialEntitlements);
  const [message, setMessage] = useState<string | null>(null);
  const [deleteArmed, setDeleteArmed] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [purchaseSuccess, setPurchaseSuccess] = useState<string | null>(null);
  const [securityOpen, setSecurityOpen] = useState(false);
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [pinHint, setPinHint] = useState('');
  const [securityMessage, setSecurityMessage] = useState<string | null>(null);
  const [isSavingSecurity, setIsSavingSecurity] = useState(false);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<PurchaseProductId>('FRIENDS_10');
  const [shareThumbnailMode, setShareThumbnailMode] = useState<ShareThumbnailMode>(initialShareThumbnailMode ?? 'DEFAULT');
  const [shareThumbnailVersion, setShareThumbnailVersion] = useState<string | null>(initialShareThumbnailVersion);
  const [shareThumbnailMessage, setShareThumbnailMessage] = useState<string | null>(null);
  const [isSavingShareThumbnail, setIsSavingShareThumbnail] = useState(false);
  const manageMainRef = useRef<HTMLElement>(null);
  const purchaseDialogRef = useRef<HTMLDialogElement>(null);
  const purchaseTriggerRef = useRef<HTMLButtonElement>(null);
  const securityDialogRef = useRef<HTMLDialogElement>(null);
  const securityTriggerRef = useRef<HTMLButtonElement>(null);
  const purchaseRequestIdRef = useRef('');
  const isPurchasingRef = useRef(false);
  const isSavingSecurityRef = useRef(false);
  const items = drawings.filter((drawing) => drawing.status !== 'DELETED');
  const bestDrawing = items.find((drawing) => (
    drawing.bestRank === 1
    && drawing.status === 'VISIBLE'
    && drawing.moderationStatus === 'ACTIVE'
  ));

  useEffect(() => {
    isPurchasingRef.current = isPurchasing;
  }, [isPurchasing]);

  useEffect(() => {
    isSavingSecurityRef.current = isSavingSecurity;
  }, [isSavingSecurity]);

  useEffect(() => {
    if (!purchaseOpen) return;
    const dialog = purchaseDialogRef.current;
    const main = manageMainRef.current;
    const trigger = purchaseTriggerRef.current;
    if (!dialog || !main) return;
    const previouslyInert = main.hasAttribute('inert');
    main.setAttribute('inert', '');
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');

    const focusableSelector = 'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (!isPurchasingRef.current) setPurchaseOpen(false);
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = [...dialog.querySelectorAll<HTMLElement>(focusableSelector)];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    dialog.addEventListener('keydown', handleKeyDown);
    dialog.querySelector<HTMLElement>(focusableSelector)?.focus();

    return () => {
      dialog.removeEventListener('keydown', handleKeyDown);
      if (dialog.open && typeof dialog.close === 'function') dialog.close();
      if (!previouslyInert) main.removeAttribute('inert');
      trigger?.focus();
    };
  }, [purchaseOpen]);

  useEffect(() => {
    if (!securityOpen) return;
    const dialog = securityDialogRef.current;
    const main = manageMainRef.current;
    const trigger = securityTriggerRef.current;
    if (!dialog || !main) return;
    const previouslyInert = main.hasAttribute('inert');
    main.setAttribute('inert', '');
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');

    const focusableSelector = 'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (!isSavingSecurityRef.current) setSecurityOpen(false);
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = [...dialog.querySelectorAll<HTMLElement>(focusableSelector)];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    dialog.addEventListener('keydown', handleKeyDown);
    dialog.querySelector<HTMLElement>(focusableSelector)?.focus();

    return () => {
      dialog.removeEventListener('keydown', handleKeyDown);
      if (dialog.open && typeof dialog.close === 'function') dialog.close();
      if (!previouslyInert) main.removeAttribute('inert');
      trigger?.focus();
    };
  }, [securityOpen]);

  function openPurchaseDialog() {
    purchaseRequestIdRef.current = globalThis.crypto?.randomUUID?.() ?? `purchase_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    setMessage(null);
    setPurchaseError(null);
    setPurchaseOpen(true);
  }

  function openSecurityDialog() {
    setSecurityMessage(null);
    setSecurityOpen(true);
  }

  async function updateDrawing(drawingId: string, body: Record<string, unknown>) {
    setMessage(null);
    const response = await fetch(`/api/manage/${publicId}/drawings/${drawingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const result = await response.json().catch(() => ({})) as { message?: string };
      setMessage(result.message ?? '변경하지 못했습니다.');
      return;
    }
    window.location.reload();
  }

  async function updateOwnerBestRank(bestRank: Drawing['bestRank']) {
    setMessage(null);
    const response = await fetch(`/api/manage/${publicId}/sketchbook`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ownerBestRank: bestRank }),
    });
    if (!response.ok) {
      const result = await response.json().catch(() => ({})) as { message?: string };
      setMessage(result.message ?? '순위를 변경하지 못했습니다.');
      return;
    }
    window.location.reload();
  }

  async function updateShareThumbnailMode(nextMode: ShareThumbnailMode) {
    if (isSavingShareThumbnail || nextMode === shareThumbnailMode) return;
    setIsSavingShareThumbnail(true);
    setShareThumbnailMessage(null);
    try {
      const response = await fetch(`/api/manage/${publicId}/sketchbook`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shareThumbnailMode: nextMode }),
      });
      const result = await response.json().catch(() => ({})) as { message?: string };
      if (!response.ok) {
        setShareThumbnailMessage(result.message ?? '링크 공유 썸네일을 변경하지 못했어요.');
        return;
      }
      setShareThumbnailMode(nextMode);
      setShareThumbnailVersion(`${nextMode.toLowerCase()}-${Date.now().toString(36)}`);
      setShareThumbnailMessage('링크 공유 썸네일을 변경했어요.');
    } catch {
      setShareThumbnailMessage('연결을 확인하고 다시 시도해 주세요.');
    } finally {
      setIsSavingShareThumbnail(false);
    }
  }

  async function deleteDrawing(drawingId: string) {
    if (!window.confirm('이 그림을 삭제할까요? 삭제하면 되돌릴 수 없습니다.')) return;
    const response = await fetch(`/api/manage/${publicId}/drawings/${drawingId}`, { method: 'DELETE' });
    if (!response.ok) {
      setMessage('그림을 삭제하지 못했습니다.');
      return;
    }
    window.location.reload();
  }

  async function purchase() {
    const plan = getPurchasePlan(selectedProductId);
    if (!plan) return;
    setIsPurchasing(true);
    setMessage(null);
    setPurchaseError(null);
    try {
      const response = await fetch(`/api/manage/${publicId}/purchase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: plan.productId, requestId: purchaseRequestIdRef.current }),
      });
      const result = await response.json().catch(() => ({})) as { entitlements?: SketchbookEntitlements; participantLimit?: number; message?: string };
      if (!response.ok || typeof result.participantLimit !== 'number' || !result.entitlements) {
        setPurchaseError(result.message ?? '결제를 처리하지 못했습니다.');
        return;
      }
      setLimit(result.participantLimit);
      setEntitlements(result.entitlements);
      setPurchaseSuccess(plan.kind === 'watermark'
        ? '워터마크 제거가 적용됐어요.'
        : `친구 그림 ${plan.additionalLimit}명이 추가됐어요.`);
      setSelectedProductId('FRIENDS_10');
      setPurchaseOpen(false);
    } catch {
      setPurchaseError('결제 연결을 확인하고 다시 시도해 주세요.');
    } finally {
      setIsPurchasing(false);
    }
  }

  async function deleteSketchbook() {
    setIsDeleting(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/manage/${publicId}/sketchbook`, { method: 'DELETE' });
      const result = await response.json().catch(() => ({})) as { message?: string };
      if (!response.ok) throw new Error(result.message ?? '스케치북을 삭제하지 못했습니다.');
      router.replace('/');
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '스케치북을 삭제하지 못했습니다.');
      setIsDeleting(false);
    }
  }

  async function logout() {
    await fetch(`/api/manage/${publicId}/session/logout`, { method: 'DELETE' });
    router.replace(`/s/${publicId}`);
    router.refresh();
  }

  async function updateSecurity(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSecurityMessage(null);
    setIsSavingSecurity(true);
    try {
      const response = await fetch(`/api/manage/${publicId}/security`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPin, newPin, hint: pinHint }),
      });
      const result = await response.json().catch(() => ({})) as { message?: string };
      if (!response.ok) {
        setSecurityMessage(result.message ?? '관리용 비밀번호를 변경하지 못했어요.');
        return;
      }
      setSecurityOpen(false);
      setCurrentPin('');
      setNewPin('');
      setPinHint('');
      setMessage('관리용 비밀번호를 변경했어요.');
    } catch {
      setSecurityMessage('연결을 확인하고 다시 시도해 주세요.');
    } finally {
      setIsSavingSecurity(false);
    }
  }

  return (
    <>
    <main className="manage-shell manage-system-sans" ref={manageMainRef}>
      <header className="public-header">
        <Link aria-label="스캐치북 홈" className="header-icon-link" href="/">←</Link>
        <span className="header-title">내 스캐치북</span>
        <HeaderMenu>
          <Link aria-label="친구 페이지 보기" href={`/s/${publicId}`} title="친구 페이지 보기">친구홈</Link>
          <Link aria-label="스토리 이미지 만들기" href={`/m/${publicId}/share`} title="스토리 이미지 만들기">스토리</Link>
          <ShareSketchbookButton menuItem name={name} previewVersion={shareThumbnailVersion} publicId={publicId} />
          <button aria-label="관리용 비밀번호 변경" onClick={openSecurityDialog} ref={securityTriggerRef} title="관리용 비밀번호 변경" type="button">비밀번호</button>
          <button aria-label="로그아웃" onClick={logout} title="로그아웃" type="button">로그아웃</button>
        </HeaderMenu>
      </header>
      <section className="manage-heading"><p className="eyebrow">{name}님의 스케치북</p><h1>친구들이 그린 나</h1></section>
      {moderationStatus === 'BLOCKED' ? (
        <section className="manage-moderation-notice status-notice status-notice--warning" role="status">
          <strong>운영자 제한</strong>
          <p>이 스케치북은 현재 친구 페이지에서 숨김 상태예요. 이 관리 화면에서 그림을 확인하거나 삭제할 수 있어요.</p>
        </section>
      ) : null}
      <section className="manage-summary">
        <p>친구 그림 <strong>{participantCount}</strong> / {limit}</p>
        <progress max={limit} value={participantCount} />
        <button className="button button--secondary" onClick={openPurchaseDialog} ref={purchaseTriggerRef} type="button">저장 공간 추가하기</button>
      </section>
      {message ? <p className="submission-success" role="status">{message}</p> : null}
      <section aria-labelledby="share-thumbnail-title" className="share-thumbnail-settings">
        <div>
          <h2 id="share-thumbnail-title">링크 공유 썸네일</h2>
          <p>카카오톡 등에 링크를 보낼 때 먼저 보여줄 그림을 선택하세요.</p>
        </div>
        <fieldset disabled={isSavingShareThumbnail}>
          <legend>공유 이미지 선택</legend>
          <label className="share-thumbnail-option share-thumbnail-option--default">
            <input
              aria-label="기본 썸네일"
              checked={shareThumbnailMode === 'DEFAULT'}
              name="share-thumbnail"
              onChange={() => updateShareThumbnailMode('DEFAULT')}
              type="radio"
            />
            <span><strong>기본 썸네일</strong><small>스캐치북 기본 공유 이미지</small></span>
          </label>
          <label className="share-thumbnail-option">
            <input
              aria-label="내가 그린 그림"
              checked={shareThumbnailMode === 'OWNER'}
              disabled={!ownerDrawingPath}
              name="share-thumbnail"
              onChange={() => updateShareThumbnailMode('OWNER')}
              type="radio"
            />
            <span><strong>내가 그린 그림</strong><small>{ownerDrawingPath ? '직접 그린 내 모습' : '내 그림이 필요해요'}</small></span>
          </label>
          <label className="share-thumbnail-option">
            <input
              aria-label="1위 그림"
              checked={shareThumbnailMode === 'BEST_1'}
              disabled={!bestDrawing}
              name="share-thumbnail"
              onChange={() => updateShareThumbnailMode('BEST_1')}
              type="radio"
            />
            <span><strong>1위 그림</strong><small>{bestDrawing ? `${bestDrawing.authorName}님의 그림` : '공개 중인 1위 그림이 필요해요'}</small></span>
          </label>
        </fieldset>
        {shareThumbnailMessage ? (
          <p aria-live="polite" className="share-thumbnail-message" role="status">{shareThumbnailMessage}</p>
        ) : null}
      </section>
      <div className="manage-actions">
        <ShareSketchbookButton name={name} previewVersion={shareThumbnailVersion} publicId={publicId} />
        <Link className="button button--primary" href={`/m/${publicId}/share`}>스토리 이미지 만들기</Link>
      </div>
      <section aria-labelledby="drawing-ranking-title" className="manage-drawings" id="drawing-ranking">
        <h2 id="drawing-ranking-title">그림 순위 선택</h2>
        <div className="friend-drawing-grid">
          {ownerDrawingPath ? (
            <article className="friend-drawing-card manage-drawing-card owner-original-card">
              <div className="manage-drawing-image managed-image-frame owner-original-image">
                {ownerBestRank ? <span className="best-badge">BEST {ownerBestRank}</span> : null}
                <ManageImage alt="직접 그린 내 모습" height={600} loading="eager" src={`/api/manage/${publicId}/owner/image`} unoptimized width={600} />
              </div>
              <p>내 그림</p>
              <span>직접 그린 내 모습</span>
              <span aria-hidden="true" className="drawing-status drawing-card-placeholder">&nbsp;</span>
              <details className="drawing-actions">
                <summary>순위 선택</summary>
                <div className="drawing-action-panel">
                  <div className="best-actions" aria-label="내 그림 BEST 순위 지정">
                    {[1, 2, 3, 4].map((rank) => (
                      <button aria-pressed={ownerBestRank === rank} key={rank} onClick={() => updateOwnerBestRank(rank as 1 | 2 | 3 | 4)} type="button">{rank}위</button>
                    ))}
                  </div>
                  {ownerBestRank ? <button onClick={() => updateOwnerBestRank(null)} type="button">BEST 해제</button> : null}
                  <Link className="button button--secondary" href={`/m/${publicId}/owner/edit`}>내 그림 수정하기</Link>
                </div>
              </details>
            </article>
          ) : null}
          {items.map((drawing, index) => (
            <article className="friend-drawing-card manage-drawing-card" key={drawing.id}>
              <div className="manage-drawing-image managed-image-frame">
                {drawing.bestRank ? <span className="best-badge">BEST {drawing.bestRank}</span> : null}
                <ManageImage alt={`${drawing.authorName}님의 그림`} height={255} loading={index === 0 ? 'eager' : 'lazy'} src={`/api/manage/${publicId}/drawings/${drawing.id}/image`} unoptimized width={255} />
              </div>
              <p>{drawing.authorName}</p>
              {drawing.message ? <span>{drawing.message}</span> : <span aria-hidden="true" className="drawing-card-placeholder">&nbsp;</span>}
              <span className="drawing-status">
                {drawing.moderationStatus === 'BLOCKED'
                  ? '운영자 숨김'
                  : drawing.status === 'VISIBLE' ? '공개 중' : '숨김'}
              </span>
              <details className="drawing-actions">
                <summary>순위 선택</summary>
                <div className="drawing-action-panel">
                  <button disabled={drawing.moderationStatus === 'BLOCKED'} onClick={() => updateDrawing(drawing.id, { action: drawing.status === 'VISIBLE' ? 'hide' : 'show' })} type="button">
                    {drawing.status === 'VISIBLE' ? '친구 페이지에서 숨기기' : '친구 페이지에 공개하기'}
                  </button>
                  <div className="best-actions" aria-label="BEST 순위 지정">
                    {[1, 2, 3, 4].map((rank) => (
                      <button aria-pressed={drawing.bestRank === rank} disabled={drawing.status !== 'VISIBLE' || drawing.moderationStatus === 'BLOCKED'} key={rank} onClick={() => updateDrawing(drawing.id, { action: 'best', bestRank: rank })} type="button">{rank}위</button>
                    ))}
                  </div>
                  {drawing.bestRank ? <button disabled={drawing.moderationStatus === 'BLOCKED'} onClick={() => updateDrawing(drawing.id, { action: 'clearBest' })} type="button">BEST 해제</button> : null}
                  <button className="danger-action" onClick={() => deleteDrawing(drawing.id)} type="button">그림 삭제</button>
                </div>
              </details>
            </article>
          ))}
          {!ownerDrawingPath && !items.length ? <p className="empty-drawings">아직 친구가 남긴 그림이 없어요.</p> : null}
        </div>
      </section>
      <section className="delete-sketchbook" aria-labelledby="delete-sketchbook-title">
        <h2 id="delete-sketchbook-title">스케치북 삭제</h2>
        <p>생성자 그림과 친구 그림을 포함한 모든 데이터가 영구 삭제되며 되돌릴 수 없어요.</p>
        {deleteArmed ? (
          <div className="delete-confirm-actions">
            <button className="button button--danger" disabled={isDeleting} onClick={deleteSketchbook} type="button">
              {isDeleting ? '삭제하는 중...' : '정말 삭제하기'}
            </button>
            <button className="button button--secondary" disabled={isDeleting} onClick={() => setDeleteArmed(false)} type="button">취소</button>
          </div>
        ) : <button className="button button--secondary danger-outline" onClick={() => setDeleteArmed(true)} type="button">스케치북 전체 삭제</button>}
      </section>
    </main>
      {purchaseOpen ? (
        <div className="purchase-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !isPurchasing) setPurchaseOpen(false); }}>
          <dialog aria-labelledby="purchase-dialog-title" className="purchase-dialog" onCancel={(event) => { event.preventDefault(); if (!isPurchasing) setPurchaseOpen(false); }} ref={purchaseDialogRef}>
            <div className="purchase-dialog-heading">
              <div><p className="eyebrow">결제</p><h2 id="purchase-dialog-title">상품 선택하기</h2></div>
              <button aria-label="결제창 닫기" className="purchase-dialog-close" disabled={isPurchasing} onClick={() => setPurchaseOpen(false)} type="button">×</button>
            </div>
            <p className="purchase-dialog-copy">친구 그림을 더 받거나 결과 이미지의 워터마크를 제거할 수 있어요.</p>
            <div className="purchase-plan-list">
            <fieldset className="purchase-plan-group">
              <legend>친구 인원 추가</legend>
              {purchasePlans.filter((plan) => plan.kind === 'capacity').map((plan) => (
                <label className="purchase-plan" key={plan.productId}>
                  <input checked={selectedProductId === plan.productId} disabled={isPurchasing} name="purchase-plan" onChange={() => setSelectedProductId(plan.productId)} type="radio" value={plan.productId} />
                  <span><strong>{plan.label}</strong><small>{plan.amount.toLocaleString('ko-KR')}원</small></span>
                </label>
              ))}
            </fieldset>
            <fieldset className="purchase-plan-group">
              <legend>결과 이미지</legend>
              {purchasePlans.filter((plan) => plan.kind === 'watermark').map((plan) => {
                const applied = entitlements.watermarkFree;
                return (
                  <label className="purchase-plan" key={plan.productId}>
                    <input checked={selectedProductId === plan.productId} disabled={isPurchasing || applied} name="purchase-plan" onChange={() => setSelectedProductId(plan.productId)} type="radio" value={plan.productId} />
                    <span><strong>{plan.label}</strong><small>{applied ? '적용됨' : `${plan.amount.toLocaleString('ko-KR')}원`}</small></span>
                  </label>
                );
              })}
            </fieldset>
            </div>
            {purchaseError ? <p className="purchase-error" role="alert">{purchaseError}</p> : null}
            <button className="button button--primary purchase-submit" disabled={isPurchasing} onClick={purchase} type="button">
              {isPurchasing ? '결제 처리 중...' : `${getPurchasePlan(selectedProductId)?.amount.toLocaleString('ko-KR')}원 결제하기`}
            </button>
            <p className="purchase-policy-note">
              추가 인원은 서비스 운영 중 만료되지 않으며, 구매일로부터 1년간 서비스를 보장합니다.{' '}
              <Link href="/terms">서비스 이용 및 결제 안내</Link>
            </p>
          </dialog>
        </div>
      ) : null}
      <PaymentSuccessDialog
        description={purchaseSuccess ?? ''}
        onClose={() => setPurchaseSuccess(null)}
        open={purchaseSuccess !== null}
        returnFocusRef={purchaseTriggerRef}
      />
      {securityOpen ? (
          <dialog aria-labelledby="manage-security-title" className="manage-security-modal manage-system-sans" onCancel={(event) => { event.preventDefault(); if (!isSavingSecurity) setSecurityOpen(false); }} ref={securityDialogRef}>
          <form className="manage-security-form" onSubmit={updateSecurity}>
            <div className="dialog-heading"><h2 id="manage-security-title">관리용 비밀번호 변경</h2><button aria-label="비밀번호 변경 닫기" className="icon-button" disabled={isSavingSecurity} onClick={() => setSecurityOpen(false)} type="button">×</button></div>
            <p>새 비밀번호는 숫자 4자리예요. 비밀번호는 복구할 수 없어요.</p>
            <label className="field-label" htmlFor="current-manage-pin">현재 비밀번호</label>
            <input autoComplete="current-password" id="current-manage-pin" inputMode="numeric" maxLength={4} onChange={(event) => setCurrentPin(event.target.value.replace(/\D/g, ''))} pattern="[0-9]{4}" required type="password" value={currentPin} />
            <label className="field-label" htmlFor="new-manage-pin">새 비밀번호</label>
            <input autoComplete="new-password" id="new-manage-pin" inputMode="numeric" maxLength={4} onChange={(event) => setNewPin(event.target.value.replace(/\D/g, ''))} pattern="[0-9]{4}" required type="password" value={newPin} />
            <label className="field-label" htmlFor="new-manage-pin-hint">비밀번호 힌트 <span className="optional-label">선택</span></label>
            <input id="new-manage-pin-hint" maxLength={40} onChange={(event) => setPinHint(event.target.value)} value={pinHint} />
            {securityMessage ? <p className="form-error" role="alert">{securityMessage}</p> : null}
            <button className="button button--primary" disabled={isSavingSecurity} type="submit">{isSavingSecurity ? '변경하는 중...' : '비밀번호 변경하기'}</button>
          </form>
          </dialog>
      ) : null}
    </>
  );
}
