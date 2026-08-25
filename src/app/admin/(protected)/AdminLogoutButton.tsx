'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/Button';

export function AdminLogoutButton() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  async function handleLogout() {
    setError(null);
    setIsLoggingOut(true);

    try {
      const response = await fetch('/api/admin/session', { method: 'DELETE' });
      if (!response.ok) throw new Error(`Logout failed with status ${response.status}`);

      router.replace('/admin/login');
      router.refresh();
    } catch {
      setError('로그아웃하지 못했습니다. 다시 시도해 주세요.');
      setIsLoggingOut(false);
    }
  }

  return (
    <div className="admin-logout">
      <Button
        className="admin-logout-button"
        disabled={isLoggingOut}
        onClick={handleLogout}
        variant="text"
      >
        {isLoggingOut ? '로그아웃 중...' : '로그아웃'}
      </Button>
      {error ? <p className="admin-logout-error" role="alert">{error}</p> : null}
    </div>
  );
}
