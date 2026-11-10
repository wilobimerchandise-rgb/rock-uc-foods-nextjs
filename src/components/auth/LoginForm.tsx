'use client';

import React, { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { RucLogo } from '../brand/RucLogo';
import { Lock, Mail, ArrowRight, AlertTriangle, Loader2 } from 'lucide-react';

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextParam = searchParams.get('next') || '/admin';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
        body: JSON.stringify({ email, password, next: nextParam }),
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
    <div className="w-full max-w-md mx-auto bg-[#17120F] border border-[#D4AF37]/30 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
      {/* Brand Header */}
      <div className="text-center space-y-2">
        <div className="flex justify-center">
          <RucLogo size={56} showWordmark={true} />
        </div>
        <h1 className="text-xl sm:text-2xl font-serif font-bold text-[#F7EFD9]">Staff &amp; Owner Portal</h1>
        <p className="text-xs text-[#F7EFD9]/60">Authorized personnel sign-in. All attempts are audited.</p>
      </div>

      {/* Error Alert */}
      {error && (
        <div
          role="alert"
          className="p-3.5 rounded-lg bg-[#B3261E]/20 border border-[#B3261E]/60 text-white flex items-center gap-2.5 text-xs sm:text-sm font-medium"
        >
          <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Login Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="login-email" className="block text-xs font-semibold text-[#D4AF37] mb-1.5 uppercase tracking-wider">
            Email Address
          </label>
          <div className="relative">
            <Mail className="w-4 h-4 text-white/40 absolute left-3.5 top-3" />
            <input
              id="login-email"
              name="email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="owner@rockucfoods.com"
              className="w-full bg-[#0B0A09] border border-white/15 focus:border-[#D4AF37] rounded-xl pl-10 pr-3 py-2.5 text-base sm:text-sm text-[#F7EFD9] placeholder:text-white/20 focus:outline-none min-h-[44px]"
            />
          </div>
        </div>

        <div>
          <label htmlFor="login-password" className="block text-xs font-semibold text-[#D4AF37] mb-1.5 uppercase tracking-wider">
            Password
          </label>
          <div className="relative">
            <Lock className="w-4 h-4 text-white/40 absolute left-3.5 top-3" />
            <input
              id="login-password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full bg-[#0B0A09] border border-white/15 focus:border-[#D4AF37] rounded-xl pl-10 pr-3 py-2.5 text-base sm:text-sm text-[#F7EFD9] placeholder:text-white/20 focus:outline-none min-h-[44px]"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full min-h-[44px] bg-[#6B1230] text-[#F7EFD9] hover:bg-[#82173B] border border-[#D4AF37]/50 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all shadow-lg hover:shadow-xl disabled:opacity-50"
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

      <div className="border-t border-white/5 pt-4 text-center">
        <p className="text-[11px] text-[#F7EFD9]/40">
          Two-step authentication (TOTP) is enforced for owner and developer roles.
        </p>
      </div>
    </div>
  );
}
