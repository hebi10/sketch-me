const STAT_PLACEHOLDERS = 6;

export default function AdminLoading() {
  return (
    <section
      aria-busy="true"
      aria-label="관리자 통계를 불러오는 중"
      className="admin-dashboard admin-loading"
      role="status"
    >
      <div className="admin-dashboard-heading">
        <p className="eyebrow">운영 현황</p>
        <h1>대시보드</h1>
        <p>통계를 불러오고 있습니다.</p>
      </div>
      <ul className="admin-stat-grid admin-stat-skeleton-list">
        {Array.from({ length: STAT_PLACEHOLDERS }, (_, index) => (
          <li className="admin-stat-card admin-stat-skeleton" key={index}>
            <span aria-hidden="true" />
            <span aria-hidden="true" />
            <span className="sr-only">통계 항목 불러오는 중</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
