'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function ManagePinForm({ publicId, hint }: { publicId: string; hint: string | null }) {
  const router = useRouter();
  const [pin, setPin] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/manage/${publicId}/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });
      const result = await response.json().catch(() => ({})) as { message?: string };
      if (!response.ok) {
        setMessage(result.message ?? '관리용 비밀번호를 확인하지 못했어요.');
        return;
      }
      router.replace(`/m/${publicId}`);
      router.refresh();
    } catch {
      setMessage('연결을 확인하고 다시 시도해 주세요.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="manage-pin-form" onSubmit={submit}>
      <label className="field-label" htmlFor="manage-pin">관리용 비밀번호</label>
      <input
        autoComplete="current-password"
        inputMode="numeric"
        id="manage-pin"
        maxLength={4}
        name="manage-pin"
        onChange={(event) => setPin(event.target.value.replace(/\D/g, ''))}
        pattern="[0-9]{4}"
        placeholder="숫자 4자리"
        required
        type="password"
        value={pin}
      />
      {hint ? <p className="field-hint">힌트: {hint}</p> : null}
      {message ? <p aria-live="polite" className="form-error" role="alert">{message}</p> : null}
      <button className="button button--primary" disabled={isSubmitting} type="submit">
        {isSubmitting ? '확인하는 중...' : '관리 페이지 열기'}
      </button>
      <p className="manage-pin-no-recovery">비밀번호는 복구할 수 없어요. 새 스케치북을 만들어 주세요.</p>
    </form>
  );
}
