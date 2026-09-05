'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AuthForm from '../../components/AuthForm';
import { isAuthenticated } from '../../lib/auth';

export default function SignupPage() {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    if (isAuthenticated()) {
      router.replace('/dashboard');
      return;
    }

    setCheckingAuth(false);
  }, [router]);

  if (checkingAuth) {
    return (
      <main className="auth-page">
        <div className="loading-state" role="status" aria-live="polite">
          Checking authentication…
        </div>
      </main>
    );
  }

  return (
    <main className="auth-page">
      <AuthForm mode="signup" />
    </main>
  );
}