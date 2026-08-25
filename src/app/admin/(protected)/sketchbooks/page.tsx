import Link from 'next/link';

import { decodeAdminCursor } from '@/lib/admin/cursor';
import { listAdminSketchbooks } from '@/lib/admin/repository';
import { getRequiredAdminIdentity } from '@/lib/admin/server-session';
import { AdminSketchbookList } from './AdminSketchbookList';

const MAX_QUERY_LENGTH = 100;
const MAX_CURSOR_LENGTH = 2_048;

type AdminSketchbooksPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function normalizeQuery(value: string | string[] | undefined) {
  return typeof value === 'string'
    ? value.trim().slice(0, MAX_QUERY_LENGTH)
    : '';
}

function parseSketchbookCursor(value: string | string[] | undefined) {
  if (value === undefined) return { cursor: undefined, invalid: false };
  if (typeof value !== 'string') return { cursor: undefined, invalid: true };

  const cursor = value.trim();
  if (!cursor || cursor.length > MAX_CURSOR_LENGTH) {
    return { cursor: undefined, invalid: true };
  }
  const decoded = decodeAdminCursor(cursor);
  const pathSegments = decoded?.path.split('/');
  if (
    !decoded
    || pathSegments?.length !== 2
    || pathSegments[0] !== 'sketchbooks'
    || !pathSegments[1]
  ) {
    return { cursor: undefined, invalid: true };
  }
  return { cursor, invalid: false };
}

function getFirstPageHref(query: string) {
  if (!query) return '/admin/sketchbooks';
  const params = new URLSearchParams({ q: query });
  return `/admin/sketchbooks?${params.toString()}`;
}

export default async function AdminSketchbooksPage({
  searchParams,
}: AdminSketchbooksPageProps) {
  const resolvedSearchParams = await searchParams;
  const query = normalizeQuery(resolvedSearchParams.q);
  const { cursor, invalid } = parseSketchbookCursor(resolvedSearchParams.cursor);

  // Security boundary: the protected layout is UX only. Authenticate every
  // server data page directly before its repository access.
  await getRequiredAdminIdentity();

  if (invalid) {
    return (
      <section className="admin-page admin-cursor-error" role="alert">
        <p className="eyebrow">페이지 오류</p>
        <h1>목록을 이어서 불러올 수 없습니다</h1>
        <p>페이지 위치 정보가 잘못되었습니다. 검색 첫 페이지부터 다시 확인해 주세요.</p>
        <Link className="button button--primary" href={getFirstPageHref(query)}>
          검색 첫 페이지로 돌아가기
        </Link>
      </section>
    );
  }

  const page = await listAdminSketchbooks({ cursor, query });
  return <AdminSketchbookList page={page} query={query} />;
}
