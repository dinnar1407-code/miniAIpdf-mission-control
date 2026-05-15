'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function LoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'idle' | 'set' | 'error'>('idle');

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setStatus('error');
      return;
    }
    document.cookie = `admin_token=${token}; path=/; max-age=2592000; SameSite=Strict; Secure`;
    setStatus('set');
    setTimeout(() => router.push('/autopilot'), 800);
  }, [searchParams, router]);

  return (
    <div className="flex items-center justify-center min-h-screen text-sm text-[#8B8B9E]">
      {status === 'idle'  && '设置中...'}
      {status === 'set'   && '已登录，跳转中...'}
      {status === 'error' && '缺少 token 参数。访问形如 /admin/login?token=YOUR_TOKEN'}
    </div>
  );
}

export default function AdminLogin() {
  return (
    <Suspense>
      <LoginInner />
    </Suspense>
  );
}
