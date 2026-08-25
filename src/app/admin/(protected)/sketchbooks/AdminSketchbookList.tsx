import Link from 'next/link';

import type {
  AdminPage,
  AdminSketchbookListItem,
} from '@/lib/admin/types';

const dateFormatter = new Intl.DateTimeFormat('ko-KR', {
  dateStyle: 'medium',
  timeZone: 'Asia/Seoul',
});

function toSafePath(basePath: string, value: string) {
  return `${basePath}/${encodeURIComponent(value)}`;
}

function getNextPageHref(query: string, cursor: string) {
  const params = new URLSearchParams();
  if (query) params.set('q', query);
  params.set('cursor', cursor);
  return `/admin/sketchbooks?${params.toString()}`;
}

function getStatusText(item: AdminSketchbookListItem) {
  return item.moderationStatus === 'BLOCKED' ? '비활성화' : '정상';
}

export function AdminSketchbookList({
  page,
  query,
}: {
  page: AdminPage<AdminSketchbookListItem>;
  query: string;
}) {
  return (
    <section aria-labelledby="admin-sketchbooks-title" className="admin-page">
      <div className="admin-page-heading">
        <p className="eyebrow">운영 관리</p>
        <h1 id="admin-sketchbooks-title">스케치북</h1>
        <p>이름이나 공개 ID로 찾고 참여 현황과 운영 상태를 확인합니다.</p>
      </div>

      <form action="/admin/sketchbooks" className="admin-search-form" method="get" role="search">
        <label className="sr-only" htmlFor="admin-sketchbook-search">스케치북 검색</label>
        <input
          defaultValue={query}
          id="admin-sketchbook-search"
          maxLength={100}
          name="q"
          placeholder="이름 또는 공개 ID"
          type="search"
        />
        <button className="button button--primary" type="submit">검색</button>
      </form>

      {page.items.length > 0 ? (
        <ul aria-label="스케치북 목록" className="admin-sketchbook-list">
          {page.items.map((item) => {
            const status = getStatusText(item);
            return (
              <li key={item.id}>
                <article className="admin-sketchbook-card">
                  <div className="admin-sketchbook-card-heading">
                    <div>
                      <h2>{item.name}</h2>
                      <p>{item.publicId}</p>
                    </div>
                    <span
                      className={`admin-status admin-status--${item.moderationStatus === 'BLOCKED' ? 'blocked' : 'active'}`}
                    >
                      {status}
                    </span>
                  </div>

                  <dl className="admin-card-facts">
                    <div>
                      <dt>생성일</dt>
                      <dd><time dateTime={item.createdAt.toISOString()}>{dateFormatter.format(item.createdAt)}</time></dd>
                    </div>
                    <div>
                      <dt>참여 현황</dt>
                      <dd>{item.participantCount.toLocaleString('ko-KR')} / {item.participantLimit.toLocaleString('ko-KR')}</dd>
                    </div>
                    <div>
                      <dt>소유자 공개</dt>
                      <dd>{item.status === 'PUBLIC' ? '공개' : '비공개'}</dd>
                    </div>
                  </dl>

                  <div className="admin-card-actions">
                    <Link
                      aria-label={`${item.name} 상세 보기`}
                      className="button button--primary"
                      href={toSafePath('/admin/sketchbooks', item.id)}
                    >
                      상세 보기
                    </Link>
                    <Link
                      aria-label={`${item.name} 공개 페이지 보기`}
                      className="button button--secondary"
                      href={toSafePath('/s', item.publicId)}
                    >
                      공개 페이지
                    </Link>
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="admin-empty-state" role="status">
          <strong>{query ? '일치하는 스케치북이 없습니다.' : '아직 운영할 스케치북이 없습니다.'}</strong>
          <p>{query ? '이름이나 공개 ID를 정확히 입력했는지 확인해 주세요.' : '새 스케치북이 만들어지면 여기에 표시됩니다.'}</p>
        </div>
      )}

      {page.nextCursor ? (
        <nav aria-label="스케치북 페이지" className="admin-pagination">
          <Link className="button button--secondary" href={getNextPageHref(query, page.nextCursor)}>
            다음 20개
          </Link>
        </nav>
      ) : null}
    </section>
  );
}
