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

  const handleCopySecret = () => {
    if (secret) {
      navigator.clipboard.writeText(secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
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
    <div className="w-full max-w-md mx-auto bg-[#17120F] border border-[#D4AF37]/30 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
      {/* Brand Header */}
      <div className="text-center space-y-2">
        <div className="flex justify-center">
          <RucLogo size={56} showWordmark={true} />
        </div>
        <h1 className="text-xl sm:text-2xl font-serif font-bold text-[#F7EFD9]">
          {mode === 'enrol' ? 'Set Up Authenticator' : 'Two-Factor Authentication'}
        </h1>
        <p className="text-xs text-[#F7EFD9]/60">
          {mode === 'enrol'
            ? 'Scan the QR code with your authenticator app (e.g. Google Authenticator).'
            : 'Enter the 6-digit code from your authenticator app.'}
        </p>
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

      {/* Enrollment QR Code Display */}
      {mode === 'enrol' && (
        <div className="space-y-4 bg-[#0B0A09] p-4 rounded-xl border border-white/10 text-center">
          {enrolling ? (
            <div className="py-8 flex flex-col items-center justify-center gap-2 text-xs text-white/50">
              <Loader2 className="w-6 h-6 animate-spin text-[#D4AF37]" />
              <span>Generating Secure Key...</span>
            </div>
          ) : qrCode ? (
            <>
              <div className="bg-white p-3 rounded-xl inline-block shadow-inner mx-auto">
                {/* QR code rendered strictly as image source */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrCode} alt="MFA Enrollment QR Code" className="w-44 h-44 mx-auto" />
              </div>

              {secret && (
                <div className="pt-2 text-left space-y-1">
                  <span className="text-[11px] text-[#D4AF37] uppercase font-semibold">Manual Setup Key</span>
                  <div className="flex items-center justify-between bg-[#17120F] px-3 py-2 rounded-lg border border-white/10 text-xs font-mono text-[#F7EFD9]">
                    <span className="select-all tracking-wider">{secret}</span>
                    <button
                      type="button"
                      onClick={handleCopySecret}
                      className="p-1 hover:text-[#D4AF37] transition-colors"
                      title="Copy Key"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
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
          <label htmlFor="mfa-code" className="block text-xs font-semibold text-[#D4AF37] mb-1.5 uppercase tracking-wider">
            6-Digit Security Code
          </label>
          <div className="relative">
            <KeyRound className="w-4 h-4 text-white/40 absolute left-3.5 top-3" />
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
              className="w-full bg-[#0B0A09] border border-white/15 focus:border-[#D4AF37] rounded-xl pl-10 pr-3 py-2.5 text-center text-xl sm:text-lg tracking-[0.3em] font-mono font-bold text-[#F7EFD9] placeholder:text-white/20 focus:outline-none min-h-[44px]"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || code.length < 6}
          className="w-full min-h-[44px] bg-[#6B1230] text-[#F7EFD9] hover:bg-[#82173B] border border-[#D4AF37]/50 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all shadow-lg hover:shadow-xl disabled:opacity-50"
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

      <div className="border-t border-white/5 pt-3 text-center">
        <button
          type="button"
          onClick={() => router.push('/login')}
          className="text-xs text-[#D4AF37] hover:underline hover:text-[#F3D98B]"
        >
          &larr; Back to sign-in
        </button>
      </div>
    </div>
  );
}
