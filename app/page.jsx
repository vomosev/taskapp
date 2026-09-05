'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { isAuthenticated } from '../lib/auth';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace(isAuthenticated() ? '/dashboard' : '/login');
  }, [router]);

  return (
    <main className="loading-state" aria-live="polite" aria-busy="true">
      <p>Loading Taskapp…</p>
    </main>
  );
}