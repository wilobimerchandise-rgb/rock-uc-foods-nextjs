'use client';

/**
 * ROCK UC FOODS - MFA & Security Management Card
 * Playbook v4 Section 23 & Section 35
 */

import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  KeyRound,
  RefreshCw,
  Copy,
  Check,
  Lock,
} from 'lucide-react';

export function MfaSetupCard() {
  const [loading, setLoading] = useState(true);
  const [isEnabled, setIsEnabled] = useState(false);
  const [accountEmail, setAccountEmail] = useState<string | null>(null);
  const [accountRole, setAccountRole] = useState<string | null>(null);
  const [backupCount, setBackupCount] = useState(0);
  const [setupSecret, setSetupSecret] = useState<string | null>(null);
  const [, setOtpauthUri] = useState<string | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [testCode, setTestCode] = useState('');
  const [testStatus, setTestStatus] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  const applyMfaPayload = (data: any) => {
    setAccountEmail(data.accountEmail || null);
    setAccountRole(data.role || null);
    setIsEnabled(Boolean(data.isEnabled));
    if (data.isEnabled) {
      setBackupCount(data.backupCodesRemaining || 0);
      setSetupSecret(null);
      setOtpauthUri(null);
      setBackupCodes([]);
    } else {
      setSetupSecret(data.setupSecret || null);
      setOtpauthUri(data.otpauthUri || null);
      setBackupCodes(Array.isArray(data.backupCodes) ? data.backupCodes : []);
    }
  };

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/security/mfa', { cache: 'no-store' });
      const data = await res.json();
      if (res.ok) {
        applyMfaPayload(data);
      }
    } catch {
      // Ignored in offline context
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let ignore = false;
    fetch('/api/security/mfa', { cache: 'no-store' })
      .then(async (res) => ({ ok: res.ok, data: await res.json() }))
      .then(({ ok, data }) => {
        if (!ignore && ok) {
          applyMfaPayload(data);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, []);

  const handleCopySecret = async () => {
    if (!setupSecret) return;
    setCopyError(null);
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error('Clipboard access unavailable in this browser.');
      }
      await navigator.clipboard.writeText(setupSecret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopyError('Copy blocked by browser permissions. Select and copy the secret manually.');
    }
  };

  const handleVerifyTestCode = async () => {
    if (!testCode.trim() || verifying) return;
    setVerifying(true);
    setTestStatus(null);

    try {
      if (!isEnabled && setupSecret) {
        const enrollRes = await fetch('/api/security/mfa', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            secret: setupSecret,
            code: testCode.trim(),
            backupCodes,
          }),
        });
        const enrollData = await enrollRes.json();
        if (enrollRes.ok) {
          setTestStatus('SUCCESS: Authenticator enrolled and MFA enforced.');
          setIsEnabled(true);
          setTestCode('');
          await fetchStatus();
        } else {
          setTestStatus(`FAILED: ${enrollData.error || 'MFA enrollment failed.'}`);
        }
        return;
      }

      const res = await fetch('/api/security/step-up', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: testCode.trim(),
          purpose: 'admin_settings_access',
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setTestStatus('SUCCESS: Code verified. Step-up token issued.');
        setIsEnabled(true);
        setTestCode('');
      } else {
        setTestStatus(`FAILED: ${data.error || 'Code verification failed.'}`);
      }
    } catch {
      setTestStatus('FAILED: Network error.');
    } finally {
      setVerifying(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 bg-[var(--bg-card)] rounded-2xl border border-[var(--border-card)] flex items-center justify-center space-x-2 text-[var(--text-body-muted)]">
        <RefreshCw className="w-4 h-4 animate-spin text-[var(--text-accent)]" />
        <span className="text-sm font-medium">Loading Security Status...</span>
      </div>
    );
  }

  return (
    <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-card)] p-5 sm:p-6 space-y-6 text-[var(--text-primary)] min-w-0 max-w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[var(--border-subtle-card)]">
        <div className="flex items-center space-x-3 min-w-0">
          <div className="w-11 h-11 rounded-xl bg-[#6B1230] border border-[#D4AF37]/50 flex items-center justify-center shrink-0">
            <Lock className="w-5 h-5 text-[#D4AF37]" />
          </div>
          <div className="min-w-0">
            <h3 className="text-lg font-black text-[var(--text-primary)]">
              Owner Security &amp; MFA Hardening
            </h3>
            <p className="text-sm text-[var(--text-body-muted)]">
              RFC 6238 Time-based One-Time Password (TOTP) with replay defense and backup recovery codes.
            </p>
            {accountEmail && (
              <p className="text-sm font-mono text-[var(--text-accent)] mt-0.5 truncate">
                {accountEmail}{accountRole ? ` · ${accountRole.toUpperCase()}` : ''}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          {isEnabled ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-sm font-bold bg-[var(--status-success-bg)] text-[var(--status-success-text)] border border-[var(--status-success-border)]">
              <ShieldCheck className="w-4 h-4 shrink-0" /> Enforced &amp; Active
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-sm font-bold bg-[var(--status-warning-bg)] text-[var(--status-warning-text)] border border-[var(--status-warning-border)]">
              <ShieldAlert className="w-4 h-4 shrink-0" /> Setup Required
            </span>
          )}
        </div>
      </div>

      {/* Main Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 min-w-0">
        {/* Left: TOTP Key & Status */}
        <div className="space-y-4 min-w-0">
          <div>
            <span className="text-sm font-bold text-[var(--text-primary)] block mb-1">
              Authenticator App Setup (Google Authenticator / 1Password)
            </span>
            <p className="text-sm text-[var(--text-body-muted)] leading-relaxed mb-3">
              {isEnabled
                ? 'Your TOTP authenticator factor is cryptographically registered and active for this account.'
                : 'Add your manual secret key into your authenticator app to generate rotating 30-second codes:'}
            </p>
            <div className="flex items-center gap-2 bg-[var(--bg-surface-muted)] p-2.5 rounded-xl border border-[var(--border-subtle-card)] font-mono text-sm min-w-0">
              <span className="text-[var(--text-accent)] tracking-wider truncate select-all flex-1 min-w-0">
                {setupSecret || 'BASE32-SECRET-ENROLLED'}
              </span>
              <button
                type="button"
                onClick={handleCopySecret}
                disabled={!setupSecret}
                aria-label="Copy authenticator secret key"
                className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-lg border border-[var(--border-subtle-card)] bg-[var(--bg-card)] text-[var(--text-primary)] hover:border-[var(--border-gold)] disabled:opacity-45 shrink-0"
                title="Copy Key"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-[var(--text-money-positive)]" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </div>
            {copyError && (
              <p role="alert" className="text-sm text-[var(--status-danger-text)] mt-2">
                {copyError}
              </p>
            )}
          </div>

          <div>
            <span className="text-sm font-bold text-[var(--text-primary)] block mb-1">
              Active Backup Recovery Codes
            </span>
            <p className="text-sm text-[var(--text-body-muted)] mb-2">
              Single-use break-glass codes for emergency access when phone is unreachable:
            </p>
            <div className="p-3.5 bg-[var(--bg-surface-muted)] rounded-xl border border-[var(--border-subtle-card)] text-sm font-mono text-[var(--text-accent)] space-y-1.5">
              <span className="text-[var(--text-primary)] font-bold block font-sans">
                {backupCount > 0 ? `${backupCount} Unused Codes Available` : `${backupCodes.length} Generated Codes`}
              </span>
              <div className="grid grid-cols-2 gap-1.5 text-sm text-[var(--text-body-muted)] pt-1">
                {backupCodes.slice(0, 4).map((c, i) => (
                  <span key={i}>{c}</span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Step-Up / Enrollment Test Box */}
        <div className="bg-[var(--bg-surface-muted)] p-5 rounded-xl border border-[var(--border-subtle-card)] space-y-4 min-w-0">
          <div>
            <label
              htmlFor="mfa-step-up-code"
              className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-1.5 mb-1"
            >
              <KeyRound className="w-4 h-4 text-[var(--text-accent)] shrink-0" />
              <span>{isEnabled ? 'Verify Step-Up Authorization' : 'Activate Authenticator Factor'}</span>
            </label>
            <p className="text-sm text-[var(--text-body-muted)] leading-relaxed mb-3">
              {isEnabled
                ? 'Test your 6-digit authenticator code or enter a backup code to verify step-up clearance:'
                : 'Enter the 6-digit code generated by your authenticator app to confirm enrollment:'}
            </p>
          </div>

          <div className="space-y-3">
            <input
              id="mfa-step-up-code"
              type="text"
              maxLength={10}
              value={testCode}
              onChange={(e) => setTestCode(e.target.value.toUpperCase())}
              placeholder="e.g. 123456 or XXXX-XXXX"
              className="w-full min-h-[44px] text-center tracking-widest text-base font-mono py-2 px-3 bg-[var(--bg-primary)] border border-[var(--border-card)] rounded-xl text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none focus:border-[var(--border-gold)]"
            />

            <button
              type="button"
              onClick={handleVerifyTestCode}
              disabled={verifying || !testCode.trim()}
              className="w-full min-h-[44px] py-2.5 px-4 bg-[#6B1230] hover:bg-[#85163c] text-[#F7EFD9] border border-[#D4AF37]/50 font-bold text-sm rounded-xl shadow transition-colors flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              {verifying ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <ShieldCheck className="w-4 h-4 text-[#D4AF37]" />
              )}
              <span>{isEnabled ? 'Test Step-Up Challenge' : 'Activate & Verify Authenticator'}</span>
            </button>

            <button
              type="button"
              onClick={fetchStatus}
              disabled={loading}
              className="w-full min-h-[44px] py-2 px-4 bg-[var(--bg-card)] hover:border-[var(--border-gold)] text-[var(--text-primary)] border border-[var(--border-subtle-card)] font-semibold text-sm rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4 text-[var(--text-accent)]" />
              <span>Refresh MFA Status</span>
            </button>

            {testStatus && (
              <div
                role={testStatus.startsWith('SUCCESS') ? 'status' : 'alert'}
                className={`p-3 rounded-lg text-sm font-semibold border ${
                  testStatus.startsWith('SUCCESS')
                    ? 'bg-[var(--status-success-bg)] text-[var(--status-success-text)] border-[var(--status-success-border)]'
                    : 'bg-[var(--status-danger-bg)] text-[var(--status-danger-text)] border-[var(--status-danger-border)]'
                }`}
              >
                {testStatus}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
