'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function CreateSketchbookForm() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/sketchbooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const data = (await response.json()) as { manageUrl?: string; message?: string };

      if (!response.ok || !data.manageUrl) {
        throw new Error(data.message ?? '스캐치북을 만들지 못했습니다. 잠시 후 다시 시도해 주세요.');
      }

      router.push(data.manageUrl);
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : '스캐치북을 만들지 못했습니다. 잠시 후 다시 시도해 주세요.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="create-intro" onSubmit={handleSubmit}>
      <p className="eyebrow">새 스캐치북</p>
      <h1 id="create-title">내 스캐치북 만들기</h1>
      <p>친구들이 부를 이름이나 애칭을 먼저 알려주세요.</p>
      <label className="field-label" htmlFor="sketchbook-name">
        이름 또는 애칭
      </label>
      <input
        id="sketchbook-name"
        maxLength={24}
        name="name"
        onChange={(event) => setName(event.target.value)}
        placeholder="예: 도영"
        required
        value={name}
      />
      {error ? <p aria-live="polite" className="form-error">{error}</p> : null}
      <button className="button button--primary" disabled={isSubmitting} type="submit">
        {isSubmitting ? '만드는 중...' : '내 스캐치북 만들기'}
      </button>
      <p className="field-hint">친구 그림 20개까지 무료로 받아볼 수 있어요.</p>
    </form>
  );
}
