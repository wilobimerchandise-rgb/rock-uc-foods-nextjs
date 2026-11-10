'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, Loader2 } from 'lucide-react';

export function LogoutButton({ className = '' }: { className?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    setLoading(true);
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
    } catch {
      // Ignored
    } finally {
      router.push('/login');
    }
  };

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      aria-label="Sign out of account"
      className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all bg-black/40 hover:bg-[#B3261E]/30 text-white/80 hover:text-white border border-white/10 hover:border-red-400/40 min-h-[36px] ${className}`}
    >
      {loading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin text-red-400" />
      ) : (
        <LogOut className="w-3.5 h-3.5 text-red-400" />
      )}
      <span>Sign out</span>
    </button>
  );
}
