import Link from 'next/link';
import { notFound } from 'next/navigation';

import { getAdminSketchbookDetail } from '@/lib/admin/repository';
import { getRequiredAdminIdentity } from '@/lib/admin/server-session';
import type { AdminDrawingListItem } from '@/lib/admin/types';
import { SketchbookModerationButton } from './SketchbookModerationButton';

const dateTimeFormatter = new Intl.DateTimeFormat('ko-KR', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Seoul',
});

const numberFormatter = new Intl.NumberFormat('ko-KR');

function toSafePath(basePath: string, value: string) {
  return `${basePath}/${encodeURIComponent(value)}`;
}

function getDrawingStatus(drawing: AdminDrawingListItem) {
  if (drawing.moderationStatus === 'BLOCKED') return '운영자 숨김';
  return drawing.status === 'VISIBLE' ? '공개' : '소유자 숨김';
}

export default async function AdminSketchbookDetailPage({
  params,
}: {
  params: Promise<{ sketchbookId: string }>;
}) {
  const { sketchbookId } = await params;

  // Security boundary: the protected layout is UX only. Authenticate every
  // server data page directly before its repository access.
  await getRequiredAdminIdentity();
  const sketchbook = await getAdminSketchbookDetail(sketchbookId);
  if (!sketchbook) notFound();

  const referenceState = !sketchbook.referenceImagePath
    ? '참고 사진 없음'
    : sketchbook.referenceImageEnabled ? '참고 사진 사용 중' : '참고 사진 있음 · 사용 안 함';

  return (
    <article className="admin-page admin-sketchbook-detail">
      <Link className="admin-back-link" href="/admin/sketchbooks">
        ← 스케치북 목록
      </Link>

      <header className="admin-page-heading admin-detail-heading">
        <div>
          <p className="eyebrow">스케치북 상세</p>
          <h1>{sketchbook.name}</h1>
          <p>{sketchbook.publicId}</p>
        </div>
        <span
          className={`admin-status admin-status--${sketchbook.moderationStatus === 'BLOCKED' ? 'blocked' : 'active'}`}
        >
          {sketchbook.moderationStatus === 'BLOCKED' ? '비활성화' : '정상'}
        </span>
      </header>

      <div className="admin-detail-actions">
        <Link
          className="button button--secondary"
          href={toSafePath('/s', sketchbook.publicId)}
        >
          공개 페이지 보기
        </Link>
        <SketchbookModerationButton
          moderationStatus={sketchbook.moderationStatus}
          sketchbookId={sketchbook.id}
        />
      </div>

      <section aria-labelledby="admin-sketchbook-overview" className="admin-detail-section">
        <h2 id="admin-sketchbook-overview">기본 정보</h2>
        <dl className="admin-detail-facts">
          <div><dt>공개 ID</dt><dd>{sketchbook.publicId}</dd></div>
          <div><dt>스케치북 ID</dt><dd>{sketchbook.id}</dd></div>
          <div><dt>생성일</dt><dd><time dateTime={sketchbook.createdAt.toISOString()}>{dateTimeFormatter.format(sketchbook.createdAt)}</time></dd></div>
          <div><dt>소유자 공개</dt><dd>{sketchbook.status === 'PUBLIC' ? '공개' : '비공개'}</dd></div>
          <div><dt>참여 현황</dt><dd>{numberFormatter.format(sketchbook.participantCount)} / {numberFormatter.format(sketchbook.participantLimit)}</dd></div>
          <div><dt>생성자 그림</dt><dd>{sketchbook.ownerDrawingPath ? '생성자 그림 있음' : '생성자 그림 없음'}</dd></div>
          <div><dt>참고 사진</dt><dd>{referenceState}</dd></div>
        </dl>
      </section>

      <section aria-labelledby="admin-sketchbook-purchases" className="admin-detail-section">
        <div className="admin-detail-section-heading">
          <h2 id="admin-sketchbook-purchases">모의 결제 요약</h2>
          <span>성공 건만 표시</span>
        </div>
        <dl className="admin-purchase-summary">
          <div><dt>결제 건수</dt><dd>{numberFormatter.format(sketchbook.purchaseSummary.count)}건</dd></div>
          <div><dt>누적 금액</dt><dd>{numberFormatter.format(sketchbook.purchaseSummary.amount)}원</dd></div>
        </dl>
      </section>

      <section aria-labelledby="admin-sketchbook-drawings" className="admin-detail-section">
        <div className="admin-detail-section-heading">
          <h2 id="admin-sketchbook-drawings">최근 친구 그림</h2>
          <span>최대 5개</span>
        </div>
        {sketchbook.recentDrawings.length > 0 ? (
          <ul className="admin-recent-drawings">
            {sketchbook.recentDrawings.map((drawing) => (
              <li key={drawing.id}>
                <div>
                  <strong>{drawing.authorName}</strong>
                  <span>{drawing.message ?? '메시지 없음'}</span>
                </div>
                <div className="admin-recent-drawing-meta">
                  <span>{getDrawingStatus(drawing)}</span>
                  <time dateTime={drawing.createdAt.toISOString()}>{dateTimeFormatter.format(drawing.createdAt)}</time>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="admin-detail-empty">아직 친구가 남긴 그림이 없습니다.</p>
        )}
      </section>
    </article>
  );
}
