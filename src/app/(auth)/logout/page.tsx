'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/app/contexts/AuthContext';

function LogoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { logout } = useAuth();

  useEffect(() => {
    const performLogout = async () => {
      await logout();
      const returnTo = searchParams.get('returnTo') || '/login';
      router.push(returnTo);
    };

    performLogout();
  }, [logout, router, searchParams]);

  return <div>Logging out...</div>;
}

export default function LogoutPage() {
  return (
    <Suspense fallback={<div>Logging out...</div>}>
      <LogoutContent />
    </Suspense>
  );
} 
