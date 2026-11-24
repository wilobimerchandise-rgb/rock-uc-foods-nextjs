'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { RucLogo } from '../brand/RucLogo';
import { Lock, Mail, ArrowRight, ArrowLeft, AlertTriangle, Loader2, Check } from 'lucide-react';

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextParam = searchParams.get('next') || '/admin';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, next: nextParam, remember }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Email or password is incorrect.');
        setLoading(false);
        return;
      }

      if (data.step === 'done') {
        router.push(data.next || '/admin');
      } else if (data.step === 'verify' || data.step === 'enrol') {
        const encodedNext = encodeURIComponent(data.next || '/admin');
        router.push(`/login/mfa?next=${encodedNext}&step=${data.step}`);
      }
    } catch {
      setError('Unable to reach the authentication service. Please check your network.');
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto min-w-0 bg-[var(--bg-card)] border border-[var(--border-card)] rounded-2xl p-5 sm:p-8 shadow-2xl space-y-6">
      <div>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 min-h-[44px] px-1 text-sm font-medium text-[var(--text-accent)] hover:underline"
        >
          <ArrowLeft className="w-4 h-4 shrink-0" />
          <span>Back to Home</span>
        </Link>
      </div>

      {/* Brand Header */}
      <div className="text-center space-y-2">
        <div className="flex justify-center">
          <RucLogo size={56} showWordmark={true} />
        </div>
        <h1 className="text-xl sm:text-2xl font-serif font-bold text-[var(--text-primary)]">
          Staff &amp; Owner Portal
        </h1>
        <p className="text-sm text-[var(--text-body-muted)]">
          Authorized personnel sign-in. All attempts are audited.
        </p>
      </div>

      {/* Error Alert */}
      {error && (
        <div
          role="alert"
          className="p-3.5 rounded-lg bg-[var(--status-danger-bg)] border border-[var(--status-danger-border)] text-[var(--status-danger-text)] flex items-center gap-2.5 text-sm font-medium"
        >
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Login Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="login-email"
            className="block text-sm font-semibold text-[var(--text-accent)] mb-1.5 tracking-wide"
          >
            Email Address
          </label>
          <div className="relative">
            <Mail className="w-4 h-4 text-[var(--text-body-muted)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="login-email"
              name="email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="owner@rockucfoods.com"
              className="w-full min-h-[44px] bg-[var(--bg-primary)] border border-[var(--border-card)] focus:border-[var(--border-gold)] rounded-xl pl-10 pr-3 py-2.5 text-base text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="login-password"
            className="block text-sm font-semibold text-[var(--text-accent)] mb-1.5 tracking-wide"
          >
            Password
          </label>
          <div className="relative">
            <Lock className="w-4 h-4 text-[var(--text-body-muted)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="login-password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full min-h-[44px] bg-[var(--bg-primary)] border border-[var(--border-card)] focus:border-[var(--border-gold)] rounded-xl pl-10 pr-3 py-2.5 text-base text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
            />
          </div>
        </div>

        {/* Keep Me Signed In (Playbook §28.5: unchecked by default) */}
        <div className="rounded-xl bg-[var(--bg-surface-muted)] border border-[var(--border-subtle-card)] px-3 py-1.5">
          <label
            htmlFor="remember"
            className="flex items-center gap-3 min-h-[44px] cursor-pointer select-none"
          >
            <span className="relative w-11 h-11 shrink-0 flex items-center justify-center">
              <input
                id="remember"
                name="remember"
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="peer appearance-none w-11 h-11 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-card)] checked:bg-[#6B1230] checked:border-[#D4AF37] cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
              />
              <Check className="w-5 h-5 text-[var(--cream)] pointer-events-none absolute opacity-0 peer-checked:opacity-100" />
            </span>
            <span className="text-sm font-medium text-[var(--text-primary)]">
              Keep me signed in for 30 days
            </span>
          </label>
          <p className="text-sm text-[var(--text-body-muted)] pl-14 pb-1">
            Leave unchecked on shared devices.
          </p>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full min-h-[44px] bg-[#6B1230] text-[#F7EFD9] hover:bg-[#82173B] border border-[#D4AF37]/60 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all shadow-lg hover:shadow-xl disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-[#D4AF37]" />
              <span>Verifying Credentials...</span>
            </>
          ) : (
            <>
              <span>Continue</span>
              <ArrowRight className="w-4 h-4 text-[#D4AF37]" />
            </>
          )}
        </button>
      </form>

      <div className="border-t border-[var(--border-subtle-card)] pt-4 text-center">
        <p className="text-sm text-[var(--text-body-muted)]">
          Two-step authentication (TOTP) is enforced for owner and developer roles.
        </p>
      </div>
    </div>
  );
}
