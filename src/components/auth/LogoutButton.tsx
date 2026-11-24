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
      className={`px-3.5 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5 transition-all bg-[var(--bg-primary)] hover:bg-[var(--status-danger-bg)] text-[var(--text-primary)] hover:text-[var(--status-danger-text)] border border-[var(--border-card)] hover:border-[var(--status-danger-border)] min-h-[44px] whitespace-nowrap ${className}`}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin text-[var(--status-danger-text)]" />
      ) : (
        <LogOut className="w-4 h-4 text-[var(--text-accent)]" />
      )}
      <span>Sign out</span>
    </button>
  );
}
