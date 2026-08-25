'use client';

import { useEffect } from 'react';

import { Button } from '@/components/ui/Button';

export default function AdminError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <section className="admin-error-state" role="alert">
      <p className="eyebrow">불러오기 오류</p>
      <h1>운영 현황을 확인할 수 없습니다.</h1>
      <p>통계를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</p>
      <Button onClick={retry}>다시 시도</Button>
    </section>
  );
}
