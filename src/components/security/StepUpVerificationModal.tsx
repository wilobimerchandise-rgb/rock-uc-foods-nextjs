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
          code: code.trim(),
          purpose,
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
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="stepup-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--ink)]/80 backdrop-blur-sm animate-fade-in"
    >
      <div className="bg-[var(--bg-card)] border border-[var(--border-gold)] w-full max-w-md rounded-2xl p-6 shadow-2xl relative text-[var(--text-primary)]">
        <button
          type="button"
          onClick={onCancel}
          className="absolute top-3 right-3 min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-lg text-[var(--text-body-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-muted)] transition-colors focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)]"
          aria-label="Cancel verification"
          title="Cancel"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-3 mb-4 pr-10">
          <div className="w-11 h-11 rounded-xl bg-[var(--cta-wine-bg)] border border-[var(--border-gold)] flex items-center justify-center shrink-0">
            <Lock className="w-5 h-5 text-[var(--gold-light)]" />
          </div>
          <div>
            <h3 id="stepup-modal-title" className="text-base font-bold text-[var(--text-primary)]">
              {title}
            </h3>
            <span className="text-sm text-[var(--text-accent)] uppercase tracking-wider font-bold">
              Protected by Owner TOTP MFA
            </span>
          </div>
        </div>

        <p className="text-sm text-[var(--text-body-muted)] mb-5 leading-relaxed">{description}</p>

        {error && (
          <div
            role="alert"
            className="mb-4 p-3 bg-[var(--status-danger-bg)] border border-[var(--status-danger-border)] rounded-xl flex items-center space-x-2 text-sm font-semibold text-[var(--status-danger-text)]"
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="stepup-totp-code" className="block text-sm font-bold text-[var(--text-primary)] mb-1">
              6-Digit Authenticator or Backup Code
            </label>
            <input
              id="stepup-totp-code"
              type="text"
              autoFocus
              maxLength={10}
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="e.g. 123456 or ABCD-1234"
              className="w-full min-h-[44px] text-center tracking-widest text-lg font-mono py-2.5 px-3 bg-[var(--bg-primary)] border border-[var(--border-card)] rounded-xl text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)]"
            />
          </div>

          <div className="flex items-center space-x-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="w-1/2 min-h-[44px] py-2.5 px-3 bg-[var(--bg-surface-muted)] hover:bg-[var(--bg-primary)] text-[var(--text-primary)] border border-[var(--border-card)] rounded-xl text-sm font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !code.trim()}
              className="w-1/2 min-h-[44px] py-2.5 px-3 bg-[var(--cta-wine-bg)] hover:bg-[#85163c] text-[var(--cta-wine-text)] border border-[var(--border-gold)] rounded-xl text-sm font-bold shadow-lg transition-colors flex items-center justify-center space-x-1.5 disabled:opacity-50"
            >
              {loading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <KeyRound className="w-4 h-4 text-[var(--gold-light)]" />
              )}
              <span>Verify &amp; Proceed</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
