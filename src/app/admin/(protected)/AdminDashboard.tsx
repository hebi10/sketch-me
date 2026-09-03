import Link from 'next/link';

import type { AdminDashboardStats } from '@/lib/admin/types';

const numberFormatter = new Intl.NumberFormat('ko-KR');

type StatItem = {
  label: string;
  value: string;
};

function getStatItems(stats: AdminDashboardStats): StatItem[] {
  return [
    { label: '전체 스케치북', value: numberFormatter.format(stats.totalSketchbooks) },
    { label: '오늘 생성', value: numberFormatter.format(stats.todaySketchbooks) },
    { label: '전체 친구 그림', value: numberFormatter.format(stats.totalDrawings) },
    { label: '오늘 제출', value: numberFormatter.format(stats.todayDrawings) },
    { label: '결제 건수', value: `${numberFormatter.format(stats.succeededPurchaseCount)}건` },
    { label: '결제 누적', value: `${numberFormatter.format(stats.succeededPurchaseAmount)}원` },
  ];
}

export function AdminDashboard({ stats }: { stats: AdminDashboardStats }) {
  return (
    <section aria-labelledby="admin-dashboard-title" className="admin-dashboard">
      <div className="admin-dashboard-heading">
        <p className="eyebrow">운영 현황</p>
        <h1 id="admin-dashboard-title">대시보드</h1>
        <p>스케치북 서비스의 주요 운영 지표를 확인합니다.</p>
      </div>

      <dl className="admin-stat-grid">
        {getStatItems(stats).map((item) => (
          <div className="admin-stat-card" key={item.label}>
            <dt>{item.label}</dt>
            <dd>{item.value}</dd>
          </div>
        ))}
      </dl>

      <p className="admin-mock-note">결제 통계는 성공 건만 포함합니다.</p>

      <nav aria-label="관리 화면 바로가기" className="admin-quick-links">
        <Link aria-describedby="admin-sketchbooks-link-description" aria-label="스케치북 관리" className="admin-list-card" href="/admin/sketchbooks">
          <strong>스케치북 관리</strong>
          <span id="admin-sketchbooks-link-description">이름, 참여 현황, 운영 상태 확인</span>
        </Link>
        <Link aria-describedby="admin-drawings-link-description" aria-label="그림 관리" className="admin-list-card" href="/admin/drawings">
          <strong>그림 관리</strong>
          <span id="admin-drawings-link-description">친구 그림과 공개 상태 검토</span>
        </Link>
        <Link aria-describedby="admin-payments-link-description" aria-label="결제 내역" className="admin-list-card" href="/admin/payments">
          <strong>결제 내역</strong>
          <span id="admin-payments-link-description">결제 성공 내역 확인</span>
        </Link>
      </nav>
    </section>
  );
}
