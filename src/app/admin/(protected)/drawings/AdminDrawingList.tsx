import Link from 'next/link';
import { useId } from 'react';

import type {
  AdminDrawingListItem,
  AdminPage,
} from '@/lib/admin/types';
import { AdminDrawingPreview } from './AdminDrawingPreview';
import { DrawingModerationButton } from './DrawingModerationButton';

const dateTimeFormatter = new Intl.DateTimeFormat('ko-KR', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Seoul',
});

function getNextPageHref(cursor: string) {
  const params = new URLSearchParams({ cursor });
  return `/admin/drawings?${params.toString()}`;
}

function getDrawingImageHref(item: AdminDrawingListItem) {
  return `/api/admin/sketchbooks/${encodeURIComponent(item.sketchbookId)}/drawings/${encodeURIComponent(item.id)}/image`;
}

function DrawingCard({ item }: { item: AdminDrawingListItem }) {
  const titleId = useId();
  const ownerStatus = item.status === 'VISIBLE' ? '소유자 공개' : '소유자 숨김';
  const moderationStatus = item.moderationStatus === 'BLOCKED'
    ? '운영자 숨김'
    : '운영 정상';

  return (
    <article aria-labelledby={titleId} className="admin-drawing-card">
      <div className="admin-drawing-card-body">
        <div className="admin-record-card-heading">
          <div>
            <h2 id={titleId}>{item.authorName}님의 그림</h2>
            <p>{item.sketchbookName}</p>
          </div>
          <span
            className={`admin-status admin-status--${item.moderationStatus === 'BLOCKED' ? 'blocked' : 'active'}`}
          >
            {moderationStatus}
          </span>
        </div>

        <AdminDrawingPreview
          alt={`${item.authorName}님의 그림`}
          src={getDrawingImageHref(item)}
        />

        <dl className="admin-card-facts">
          <div>
            <dt>공개 ID</dt>
            <dd>{item.sketchbookPublicId}</dd>
          </div>
          <div>
            <dt>제출일</dt>
            <dd>
              <time dateTime={item.createdAt.toISOString()}>
                {dateTimeFormatter.format(item.createdAt)}
              </time>
            </dd>
          </div>
          <div>
            <dt>소유자 상태</dt>
            <dd>{ownerStatus}</dd>
          </div>
          <div>
            <dt>운영 상태</dt>
            <dd>{moderationStatus}</dd>
          </div>
        </dl>

        <div className="admin-record-action">
          <DrawingModerationButton
            drawingId={item.id}
            moderationStatus={item.moderationStatus}
            sketchbookId={item.sketchbookId}
          />
        </div>
      </div>
    </article>
  );
}

export function AdminDrawingList({
  page,
}: {
  page: AdminPage<AdminDrawingListItem>;
}) {
  return (
    <section aria-labelledby="admin-drawings-title" className="admin-page">
      <div className="admin-page-heading">
        <p className="eyebrow">운영 관리</p>
        <h1 id="admin-drawings-title">친구 그림</h1>
        <p>소유자의 공개 선택과 운영 상태를 함께 확인하고 서비스 노출을 관리합니다.</p>
      </div>

      {page.items.length > 0 ? (
        <ul aria-label="친구 그림 목록" className="admin-record-list">
          {page.items.map((item) => (
            <li key={`${item.sketchbookId}/${item.id}`}>
              <DrawingCard item={item} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="admin-empty-state" role="status">
          <strong>검토할 친구 그림이 없습니다.</strong>
          <p>친구가 그림을 제출하면 최신 순서로 여기에 표시됩니다.</p>
        </div>
      )}

      {page.nextCursor ? (
        <nav aria-label="친구 그림 페이지" className="admin-pagination">
          <Link className="button button--secondary" href={getNextPageHref(page.nextCursor)}>
            다음 20개
          </Link>
        </nav>
      ) : null}
    </section>
  );
}
