'use client';

import {
  GoogleAuthProvider,
  inMemoryPersistence,
  setPersistence,
  signInWithPopup,
  signOut,
  type Auth,
} from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { BrandWordmark } from '@/components/ui/BrandWordmark';
import { Button } from '@/components/ui/Button';
import { getFirebaseClientAuth } from '@/lib/firebase/auth-client';

class AdminSessionResponseError extends Error {
  constructor(public readonly status: number) {
    super(`Admin session request failed with status ${status}`);
    this.name = 'AdminSessionResponseError';
  }
}

function isPopupCancelled(error: unknown): boolean {
  if (!error || typeof error !== 'object' || !('code' in error)) {
    return false;
  }

  return error.code === 'auth/popup-closed-by-user'
    || error.code === 'auth/cancelled-popup-request';
}

function getLoginErrorMessage(error: unknown): string {
  if (isPopupCancelled(error)) {
    return '로그인이 취소됐습니다.';
  }

  if (error instanceof AdminSessionResponseError) {
    if (error.status === 401) {
      return '로그인 시간이 지났습니다. 다시 시도해 주세요.';
    }
    if (error.status === 403) {
      return '허용된 관리자 계정이 아닙니다.';
    }
    return '로그인 처리 중 오류가 발생했습니다.';
  }

  if (error instanceof TypeError) {
    return '로그인 연결을 확인해 주세요.';
  }

  return '로그인 처리 중 오류가 발생했습니다.';
}

async function clearClientAuth(auth: Auth | null): Promise<void> {
  if (!auth) return;
  await signOut(auth).catch(() => undefined);
}

export function AdminLogin() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  async function handleLogin() {
    setError(null);
    setIsLoggingIn(true);

    let auth: Auth | null = null;
    let hasSignedIn = false;

    try {
      auth = getFirebaseClientAuth();
      await setPersistence(auth, inMemoryPersistence);

      const credential = await signInWithPopup(auth, new GoogleAuthProvider());
      hasSignedIn = true;
      const idToken = await credential.user.getIdToken();
      const response = await fetch('/api/admin/session', {
        body: JSON.stringify({ idToken }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      });

      if (!response.ok) {
        throw new AdminSessionResponseError(response.status);
      }

      await signOut(auth);
      hasSignedIn = false;
      router.replace('/admin');
    } catch (loginError) {
      if (hasSignedIn) {
        await clearClientAuth(auth);
      }
      setError(getLoginErrorMessage(loginError));
    } finally {
      setIsLoggingIn(false);
    }
  }

  return (
    <section aria-labelledby="admin-login-title" className="create-flow">
      <div className="create-intro">
        <BrandWordmark />
        <p className="eyebrow">운영자 전용</p>
        <h1 id="admin-login-title">관리자 로그인</h1>
        <p>허용된 Google 계정으로 로그인해 스캐치북 운영 화면으로 이동합니다.</p>
      </div>

      {error ? <p className="form-error" role="alert">{error}</p> : null}

      <Button
        className="create-submit"
        disabled={isLoggingIn}
        onClick={handleLogin}
      >
        {isLoggingIn ? '로그인하는 중...' : 'Google 계정으로 로그인'}
      </Button>
      <p className="field-hint">지정된 관리자 계정만 접근할 수 있습니다.</p>
    </section>
  );
}
