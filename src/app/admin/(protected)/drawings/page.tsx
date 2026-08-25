import Link from 'next/link';

import {
  decodeAdminCursor,
  isAdminCursorForCollection,
} from '@/lib/admin/cursor';
import { listAdminDrawings } from '@/lib/admin/repository';
import { getRequiredAdminIdentity } from '@/lib/admin/server-session';
import { AdminDrawingList } from './AdminDrawingList';

const MAX_CURSOR_LENGTH = 2_048;

type AdminDrawingsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function parseDrawingCursor(value: string | string[] | undefined) {
  if (value === undefined) return { cursor: undefined, invalid: false };
  if (typeof value !== 'string') return { cursor: undefined, invalid: true };

  const cursor = value.trim();
  if (!cursor || cursor.length > MAX_CURSOR_LENGTH) {
    return { cursor: undefined, invalid: true };
  }
  const decoded = decodeAdminCursor(cursor);
  if (!decoded || !isAdminCursorForCollection(decoded, 'drawings')) {
    return { cursor: undefined, invalid: true };
  }
  return { cursor, invalid: false };
}

export default async function AdminDrawingsPage({
  searchParams,
}: AdminDrawingsPageProps) {
  const resolvedSearchParams = await searchParams;
  const { cursor, invalid } = parseDrawingCursor(resolvedSearchParams.cursor);

  await getRequiredAdminIdentity();

  if (invalid) {
    return (
      <section className="admin-page admin-cursor-error" role="alert">
        <p className="eyebrow">페이지 오류</p>
        <h1>그림 목록을 이어서 불러올 수 없습니다</h1>
        <p>페이지 위치 정보가 잘못되었습니다. 그림 첫 페이지부터 다시 확인해 주세요.</p>
        <Link className="button button--primary" href="/admin/drawings">
          그림 첫 페이지로 돌아가기
        </Link>
      </section>
    );
  }

  const page = await listAdminDrawings({ cursor });
  return <AdminDrawingList page={page} />;
}
