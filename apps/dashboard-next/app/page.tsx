'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AUTH_TEMP_DISABLED, enterUiDemoMode, getToken } from '@/lib/auth';

export default function Home() {
  const router = useRouter();
  useEffect(() => {
    if (AUTH_TEMP_DISABLED) {
      enterUiDemoMode({ username: 'guest' });
      router.replace('/dashboard');
      return;
    }
    if (getToken()) {
      router.replace('/dashboard');
    } else {
      router.replace('/login');
    }
  }, [router]);
  return null;
}
