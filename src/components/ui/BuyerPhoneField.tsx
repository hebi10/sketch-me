'use client';

interface BuyerPhoneFieldProps {
  disabled?: boolean;
  error?: string | null;
  id: string;
  onChange: (value: string) => void;
  value: string;
}

export function BuyerPhoneField({ disabled, error, id, onChange, value }: BuyerPhoneFieldProps) {
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  return (
    <div className="buyer-phone-field">
      <label htmlFor={id}>결제용 휴대전화번호</label>
      <input
        aria-describedby={error ? `${hintId} ${errorId}` : hintId}
        aria-invalid={Boolean(error)}
        autoComplete="tel"
        disabled={disabled}
        id={id}
        inputMode="tel"
        maxLength={13}
        onChange={(event) => onChange(event.target.value.replace(/[^0-9\s-]/g, ''))}
        placeholder="010-1234-5678"
        required
        type="tel"
        value={value}
      />
      <small id={hintId}>페이앱 결제 안내와 본인 확인에 사용됩니다.</small>
      {error ? <p id={errorId} role="alert">{error}</p> : null}
    </div>
  );
}
