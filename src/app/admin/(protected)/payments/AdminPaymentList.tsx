import Link from 'next/link';
import { useId } from 'react';

import type {
  AdminPage,
  AdminPurchaseListItem,
} from '@/lib/admin/types';

const dateTimeFormatter = new Intl.DateTimeFormat('ko-KR', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Seoul',
});

const paymentStatusLabels: Record<AdminPurchaseListItem['paymentStatus'], string> = {
  CANCELLED: '취소',
  FAILED: '실패',
  READY: '대기',
  SUCCEEDED: '성공',
};

function getNextPageHref(cursor: string) {
  const params = new URLSearchParams({ cursor });
  return `/admin/payments?${params.toString()}`;
}

function PaymentCard({ item }: { item: AdminPurchaseListItem }) {
  const titleId = useId();
  const paidAt = item.paidAt;

  return (
    <article aria-labelledby={titleId} className="admin-payment-card">
      <div className="admin-record-card-heading">
        <div>
          <h2 id={titleId}>{item.orderId} 결제</h2>
          <p>{item.sketchbookName}</p>
        </div>
        <span className="admin-status admin-status--mock">
          {item.provider === 'MOCK' ? '모의 결제' : '결제'}
        </span>
      </div>

      <dl className="admin-card-facts">
        <div>
          <dt>주문번호</dt>
          <dd>{item.orderId}</dd>
        </div>
        <div>
          <dt>공개 ID</dt>
          <dd>{item.sketchbookPublicId}</dd>
        </div>
        <div>
          <dt>상품</dt>
          <dd>{item.productType}</dd>
        </div>
        <div>
          <dt>추가 인원</dt>
          <dd>+{item.additionalLimit.toLocaleString('ko-KR')}명</dd>
        </div>
        <div>
          <dt>금액</dt>
          <dd>{item.amount.toLocaleString('ko-KR')}원</dd>
        </div>
        <div>
          <dt>결제 상태</dt>
          <dd>{paymentStatusLabels[item.paymentStatus]}</dd>
        </div>
        <div>
          <dt>결제 시간</dt>
          <dd>
            {paidAt ? (
              <time dateTime={paidAt.toISOString()}>
                {dateTimeFormatter.format(paidAt)}
              </time>
            ) : '아직 결제되지 않음'}
          </dd>
        </div>
      </dl>
    </article>
  );
}

export function AdminPaymentList({
  page,
}: {
  page: AdminPage<AdminPurchaseListItem>;
}) {
  return (
    <section aria-labelledby="admin-payments-title" className="admin-page">
      <div className="admin-page-heading">
        <p className="eyebrow">조회 전용</p>
        <h1 id="admin-payments-title">모의 결제 목록</h1>
        <p>현재 내역은 실제 결제가 아닌 모의 결제이며, 이 화면에서는 조회만 할 수 있습니다.</p>
      </div>

      {page.items.length > 0 ? (
        <ul aria-label="모의 결제 목록" className="admin-record-list">
          {page.items.map((item) => (
            <li key={`${item.sketchbookId}/${item.id}`}>
              <PaymentCard item={item} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="admin-empty-state" role="status">
          <strong>아직 모의 결제 내역이 없습니다.</strong>
          <p>참여 인원 추가를 테스트하면 최신 순서로 여기에 표시됩니다.</p>
        </div>
      )}

      {page.nextCursor ? (
        <nav aria-label="모의 결제 페이지" className="admin-pagination">
          <Link className="button button--secondary" href={getNextPageHref(page.nextCursor)}>
            다음 20개
          </Link>
        </nav>
      ) : null}
    </section>
  );
}
