'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { RucLogo } from '../brand/RucLogo';
import { ShieldCheck, KeyRound, ArrowRight, AlertTriangle, Loader2, Copy, Check } from 'lucide-react';

export function MfaForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextParam = searchParams.get('next') || '/admin';
  const initialStep = searchParams.get('step') as 'enrol' | 'verify' | null;

  const [mode, setMode] = useState<'verify' | 'enrol'>(initialStep === 'enrol' ? 'enrol' : 'verify');
  const [code, setCode] = useState('');
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // If in enrol mode, fetch setup credentials
  useEffect(() => {
    let isMounted = true;
    if (mode === 'enrol' && !qrCode) {
      const initEnrollment = async () => {
        try {
          setEnrolling(true);
          const res = await fetch('/api/auth/mfa/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
          });
          const data = await res.json();
          if (!isMounted) return;

          if (data.error) {
            if (data.error.includes('already enrolled')) {
              setMode('verify');
            } else {
              setError(data.error);
            }
          } else {
            setFactorId(data.factorId);
            setQrCode(data.qrCode);
            setSecret(data.secret);
          }
        } catch {
          if (isMounted) {
            setError('Failed to initialize authenticator enrollment. Please try again.');
          }
        } finally {
          if (isMounted) {
            setEnrolling(false);
          }
        }
      };

      initEnrollment();
    }

    return () => {
      isMounted = false;
    };
  }, [mode, qrCode]);

  const handleCopySecret = async () => {
    if (!secret) return;
    try {
      await navigator.clipboard?.writeText(secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Unable to copy secret automatically. Please highlight and copy the key manually.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanCode = code.replace(/\s+/g, '');
    if (cleanCode.length !== 6 || !/^\d{6}$/.test(cleanCode)) {
      setError('Verification code must be exactly 6 digits.');
      return;
    }

    setLoading(true);

    try {
      const payload: Record<string, unknown> = {
        code: cleanCode,
        next: nextParam,
      };

      if (mode === 'enrol' && factorId) {
        payload.factorId = factorId;
      }

      const res = await fetch('/api/auth/mfa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Invalid 6-digit verification code.');
        setLoading(false);
        return;
      }

      router.push(data.next || '/admin');
    } catch {
      setError('Unable to verify code. Please check your connection.');
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto min-w-0 bg-[var(--bg-card)] border border-[var(--border-card)] rounded-2xl p-5 sm:p-8 shadow-2xl space-y-6">
      {/* Brand Header */}
      <div className="text-center space-y-2">
        <div className="flex justify-center">
          <RucLogo size={56} showWordmark={true} />
        </div>
        <h1 className="text-xl sm:text-2xl font-serif font-bold text-[var(--text-primary)]">
          {mode === 'enrol' ? 'Set Up Authenticator' : 'Two-Factor Authentication'}
        </h1>
        <p className="text-sm text-[var(--text-body-muted)]">
          {mode === 'enrol'
            ? 'Scan the QR code with your authenticator app (e.g. Google Authenticator).'
            : 'Enter the 6-digit code from your authenticator app.'}
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

      {/* Enrollment QR Code Display */}
      {mode === 'enrol' && (
        <div className="space-y-4 bg-[var(--bg-primary)] p-4 rounded-xl border border-[var(--border-subtle-card)] text-center">
          {enrolling ? (
            <div className="py-8 flex flex-col items-center justify-center gap-2 text-sm text-[var(--text-body-muted)]">
              <Loader2 className="w-6 h-6 animate-spin text-[var(--text-accent)]" />
              <span>Generating Secure Key...</span>
            </div>
          ) : qrCode ? (
            <>
              <div className="bg-white p-3 rounded-xl inline-block shadow-inner mx-auto">
                {/* QR code rendered strictly as image source */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrCode} alt="MFA Enrollment QR Code" className="w-44 h-44 mx-auto" referrerPolicy="no-referrer" />
              </div>

              {secret && (
                <div className="pt-2 text-left space-y-1.5">
                  <span className="text-sm text-[var(--text-accent)] font-semibold block">
                    Manual Setup Key
                  </span>
                  <div className="flex items-center justify-between gap-2 bg-[var(--bg-card)] px-3 py-1.5 rounded-lg border border-[var(--border-card)] text-sm font-mono text-[var(--text-primary)]">
                    <span className="select-all tracking-wider break-all min-w-0">{secret}</span>
                    <button
                      type="button"
                      onClick={handleCopySecret}
                      aria-label={copied ? 'Setup key copied' : 'Copy manual setup key'}
                      className="min-w-[44px] min-h-[44px] shrink-0 inline-flex items-center justify-center rounded-lg hover:text-[var(--text-accent)] transition-colors"
                      title="Copy Key"
                    >
                      {copied ? (
                        <Check className="w-4 h-4 text-[var(--text-money-positive)]" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>
      )}

      {/* Verification Code Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="mfa-code"
            className="block text-sm font-semibold text-[var(--text-accent)] mb-1.5 tracking-wide"
          >
            6-Digit Security Code
          </label>
          <div className="relative">
            <KeyRound className="w-4 h-4 text-[var(--text-body-muted)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="mfa-code"
              name="code"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="one-time-code"
              maxLength={6}
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder="123456"
              className="w-full min-h-[44px] bg-[var(--bg-primary)] border border-[var(--border-card)] focus:border-[var(--border-gold)] rounded-xl pl-10 pr-3 py-2.5 text-center text-xl tracking-[0.25em] font-mono font-bold text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || code.length < 6}
          className="w-full min-h-[44px] bg-[#6B1230] text-[#F7EFD9] hover:bg-[#82173B] border border-[#D4AF37]/60 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all shadow-lg hover:shadow-xl disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-[#D4AF37]" />
              <span>Verifying Code...</span>
            </>
          ) : (
            <>
              <ShieldCheck className="w-4 h-4 text-[#D4AF37]" />
              <span>Verify and Sign In</span>
              <ArrowRight className="w-4 h-4 text-[#D4AF37]" />
            </>
          )}
        </button>
      </form>

      <div className="border-t border-[var(--border-subtle-card)] pt-3 text-center">
        <button
          type="button"
          onClick={() => router.push('/login')}
          className="min-h-[44px] px-4 inline-flex items-center justify-center text-sm font-medium text-[var(--text-accent)] hover:underline"
        >
          &larr; Back to sign-in
        </button>
      </div>
    </div>
  );
}
