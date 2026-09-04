import Link from 'next/link';

interface PurchaseConsentProps {
  checked: boolean;
  disabled?: boolean;
  id: string;
  onChange: (checked: boolean) => void;
}

export function PurchaseConsent({ checked, disabled = false, id, onChange }: PurchaseConsentProps) {
  const descriptionId = `${id}-description`;

  return (
    <div className="purchase-consent">
      <label htmlFor={id}>
        <input
          aria-describedby={descriptionId}
          checked={checked}
          disabled={disabled}
          id={id}
          onChange={(event) => onChange(event.target.checked)}
          required
          type="checkbox"
        />
        <span>(필수) 결제 완료 즉시 디지털 혜택 제공이 시작되는 것에 동의합니다.</span>
      </label>
      <p id={descriptionId}>
        결제 전 친구 그림 10개 무료 이용 또는 워터마크 미리보기를 확인할 수 있습니다.
        계약내용을 받은 날부터 7일 이내 청약철회할 수 있으나, 동의 후 혜택 제공이 시작되면
        관련 법령에 따라 제한될 수 있습니다. 법정대리인의 동의가 없는 미성년자 계약은 취소할 수 있습니다.{' '}
        <Link href="/terms#withdrawal">서비스 이용 및 결제 안내</Link>
      </p>
    </div>
  );
}
