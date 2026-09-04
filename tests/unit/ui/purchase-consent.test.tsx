import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';

import { PurchaseConsent } from '@/components/ui/PurchaseConsent';

describe('PurchaseConsent', () => {
  it('디지털 콘텐츠 체험 범위와 미성년자 계약 취소 권리를 결제 전에 안내한다', () => {
    render(
      <PurchaseConsent
        checked={false}
        id="purchase-consent"
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByText(/친구 그림 10개 무료 이용 또는 워터마크 미리보기/)).toBeVisible();
    expect(screen.getByText(/계약내용을 받은 날부터 7일 이내/)).toBeVisible();
    expect(screen.getByText(/법정대리인의 동의가 없는 미성년자 계약은 취소할 수 있습니다/)).toBeVisible();
  });
});
