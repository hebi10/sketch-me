import { BUSINESS_INFO } from '@/lib/business';

export function BusinessDisclosure({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <address className="business-disclosure business-disclosure--compact">
        <p>상호 {BUSINESS_INFO.name} · 대표자 {BUSINESS_INFO.representative}</p>
        <p>사업자등록번호 {BUSINESS_INFO.businessRegistrationNumber}</p>
        <p>업태 및 종목 {BUSINESS_INFO.businessType}</p>
        <p>사업장 {BUSINESS_INFO.address}</p>
        <p>
          고객센터{' '}
          <a href={`mailto:${BUSINESS_INFO.email}`}>{BUSINESS_INFO.email}</a>
        </p>
      </address>
    );
  }

  return (
    <dl className="business-disclosure legal-data-list">
      <div>
        <dt>상호</dt>
        <dd>{BUSINESS_INFO.name}</dd>
      </div>
      <div>
        <dt>대표자</dt>
        <dd>{BUSINESS_INFO.representative}</dd>
      </div>
      <div>
        <dt>사업자등록번호</dt>
        <dd>{BUSINESS_INFO.businessRegistrationNumber}</dd>
      </div>
      <div>
        <dt>업태 및 종목</dt>
        <dd>{BUSINESS_INFO.businessType}</dd>
      </div>
      <div>
        <dt>사업장 소재지</dt>
        <dd>{BUSINESS_INFO.address}</dd>
      </div>
      <div>
        <dt>고객센터</dt>
        <dd><a href={`mailto:${BUSINESS_INFO.email}`}>{BUSINESS_INFO.email}</a></dd>
      </div>
    </dl>
  );
}
