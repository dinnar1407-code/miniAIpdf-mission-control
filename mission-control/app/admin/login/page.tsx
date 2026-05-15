'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminLogin() {
  const router = useRouter();
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/admin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });

      if (!res.ok) {
        setError('Token 不对');
        setLoading(false);
        return;
      }

      router.push('/autopilot');
    } catch {
      setError('网络错误');
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen p-4 bg-[#0A0A0F]">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <h1 className="text-xl font-semibold text-center text-white">Mission Ctrl 登录</h1>
        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="Admin token"
          className="w-full px-3 py-2 rounded-md bg-[#12121A] border border-[#2A2A3A] text-sm text-white placeholder-[#555566] focus:outline-none focus:border-[#6366F1]"
          autoComplete="current-password"
          autoFocus
        />
        {error && <p className="text-xs text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={loading || !token}
          className="w-full py-2 rounded-md bg-[#6366F1] hover:bg-[#5254CC] disabled:opacity-50 text-sm text-white font-medium transition-colors"
        >
          {loading ? '验证中...' : '登录'}
        </button>
      </form>
    </div>
  );
}
