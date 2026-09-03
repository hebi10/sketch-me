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
        제공 시작 후에는 청약철회가 제한될 수 있습니다.{' '}
        <Link href="/terms#closure">서비스 이용 및 결제 안내</Link>
      </p>
    </div>
  );
}
