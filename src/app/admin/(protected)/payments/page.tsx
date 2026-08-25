import Link from 'next/link';

import {
  decodeAdminCursor,
  isAdminCursorForCollection,
} from '@/lib/admin/cursor';
import { listAdminPurchases } from '@/lib/admin/repository';
import { getRequiredAdminIdentity } from '@/lib/admin/server-session';
import { AdminPaymentList } from './AdminPaymentList';

const MAX_CURSOR_LENGTH = 2_048;

type AdminPaymentsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function parsePaymentCursor(value: string | string[] | undefined) {
  if (value === undefined) return { cursor: undefined, invalid: false };
  if (typeof value !== 'string') return { cursor: undefined, invalid: true };

  const cursor = value.trim();
  if (!cursor || cursor.length > MAX_CURSOR_LENGTH) {
    return { cursor: undefined, invalid: true };
  }
  const decoded = decodeAdminCursor(cursor);
  if (!decoded || !isAdminCursorForCollection(decoded, 'purchases')) {
    return { cursor: undefined, invalid: true };
  }
  return { cursor, invalid: false };
}

export default async function AdminPaymentsPage({
  searchParams,
}: AdminPaymentsPageProps) {
  const resolvedSearchParams = await searchParams;
  const { cursor, invalid } = parsePaymentCursor(resolvedSearchParams.cursor);

  await getRequiredAdminIdentity();

  if (invalid) {
    return (
      <section className="admin-page admin-cursor-error" role="alert">
        <p className="eyebrow">페이지 오류</p>
        <h1>결제 목록을 이어서 불러올 수 없습니다</h1>
        <p>페이지 위치 정보가 잘못되었습니다. 결제 첫 페이지부터 다시 확인해 주세요.</p>
        <Link className="button button--primary" href="/admin/payments">
          결제 첫 페이지로 돌아가기
        </Link>
      </section>
    );
  }

  const page = await listAdminPurchases({ cursor });
  return <AdminPaymentList page={page} />;
}
