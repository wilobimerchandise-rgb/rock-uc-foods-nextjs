'use client';

/**
 * ROCK UC FOODS - Step-Up Verification Modal
 * Playbook v4 Section 23
 */

import React, { useState } from 'react';
import { ShieldAlert, Lock, KeyRound, AlertCircle, RefreshCw, X } from 'lucide-react';
import { SensitiveOperation } from '../../types/security';

interface StepUpVerificationModalProps {
  isOpen: boolean;
  purpose: SensitiveOperation;
  title?: string;
  description?: string;
  onSuccess: (stepUpToken: string) => void;
  onCancel: () => void;
}

export function StepUpVerificationModal({
  isOpen,
  purpose,
  title = 'High-Security Authorization Required',
  description = 'Please enter your 6-digit Authenticator code or an 8-character backup recovery code to confirm this action.',
  onSuccess,
  onCancel,
}: StepUpVerificationModalProps) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || loading) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/security/step-up', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: 'usr-owner-01',
          code: code.trim(),
          purpose,
          userRole: 'owner',
        }),
      });

      const data = await res.json();
      if (res.ok && data.stepUpToken) {
        onSuccess(data.stepUpToken);
      } else {
        setError(data.error || 'Authentication code verification failed.');
      }
    } catch {
      setError('Network error verifying code.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#17120F] border border-[#D4AF37]/40 w-full max-w-md rounded-2xl p-6 shadow-2xl relative text-[#F7EFD9]">
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 text-white/40 hover:text-white transition-colors"
          title="Cancel"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-[#6B1230] border border-[#D4AF37]/50 flex items-center justify-center shrink-0">
            <Lock className="w-5 h-5 text-[#D4AF37]" />
          </div>
          <div>
            <h3 className="text-base font-black text-white">{title}</h3>
            <span className="text-[10px] text-[#D4AF37] uppercase tracking-wider font-bold">
              Protected by Owner TOTP MFA
            </span>
          </div>
        </div>

        <p className="text-xs text-[#F7EFD9]/70 mb-5 leading-relaxed">{description}</p>

        {error && (
          <div className="mb-4 p-3 bg-rose-950/50 border border-rose-500/50 rounded-xl flex items-center space-x-2 text-xs text-rose-300">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-[#F7EFD9]/80 mb-1">
              6-Digit Authenticator or Backup Code
            </label>
            <input
              type="text"
              autoFocus
              maxLength={10}
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="e.g. 123456 or ABCD-1234"
              className="w-full text-center tracking-widest text-lg font-mono py-2.5 px-3 bg-black/50 border border-white/20 rounded-xl text-white focus:outline-none focus:border-[#D4AF37]"
            />
          </div>

          <div className="flex items-center space-x-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="w-1/2 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !code.trim()}
              className="w-1/2 py-2.5 bg-[#6B1230] hover:bg-[#85163c] text-white rounded-xl text-xs font-bold shadow-lg transition-colors flex items-center justify-center space-x-1.5 disabled:opacity-50"
            >
              {loading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <KeyRound className="w-4 h-4 text-[#D4AF37]" />
              )}
              <span>Verify &amp; Proceed</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
