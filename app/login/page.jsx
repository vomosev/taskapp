'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AuthForm from '../../components/AuthForm';
import { isAuthenticated } from '../../lib/auth';

export default function LoginPage() {
  const router = useRouter();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  useEffect(() => {
    if (isAuthenticated()) {
      router.replace('/dashboard');
      return;
    }

    setIsCheckingAuth(false);
  }, [router]);

  if (isCheckingAuth) {
    return (
      <main className="auth-page">
        <div className="loading-state" role="status" aria-live="polite">
          Loading...
        </div>
      </main>
    );
  }

  return (
    <main className="auth-page">
      <AuthForm mode="login" />
    </main>
  );
}