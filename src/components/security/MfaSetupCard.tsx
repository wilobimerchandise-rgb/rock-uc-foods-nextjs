'use client';

/**
 * ROCK UC FOODS - MFA & Security Management Card
 * Playbook v4 Section 23
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
  Download,
} from 'lucide-react';

export function MfaSetupCard() {
  const [loading, setLoading] = useState(true);
  const [isEnabled, setIsEnabled] = useState(false);
  const [backupCount, setBackupCount] = useState(0);
  const [setupSecret, setSetupSecret] = useState<string | null>(null);
  const [otpauthUri, setOtpauthUri] = useState<string | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [testCode, setTestCode] = useState('');
  const [testStatus, setTestStatus] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/security/mfa?userId=usr-owner-01');
      const data = await res.json();
      if (res.ok) {
        setIsEnabled(data.isEnabled);
        if (data.isEnabled) {
          setBackupCount(data.backupCodesRemaining || 0);
        } else {
          setSetupSecret(data.setupSecret);
          setOtpauthUri(data.otpauthUri);
          setBackupCodes(data.backupCodes || []);
        }
      }
    } catch {
      // Ignored in offline demo
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let ignore = false;
    fetch('/api/security/mfa?userId=usr-owner-01')
      .then((res) => res.json())
      .then((data) => {
        if (!ignore) {
          setIsEnabled(data.isEnabled);
          if (data.isEnabled) {
            setBackupCount(data.backupCodesRemaining || 0);
          } else {
            setSetupSecret(data.setupSecret);
            setOtpauthUri(data.otpauthUri);
            setBackupCodes(data.backupCodes || []);
          }
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

  const handleCopySecret = () => {
    if (!setupSecret) return;
    navigator.clipboard.writeText(setupSecret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleVerifyTestCode = async () => {
    if (!testCode.trim() || verifying) return;
    setVerifying(true);
    setTestStatus(null);

    try {
      const res = await fetch('/api/security/step-up', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: 'usr-owner-01',
          code: testCode.trim(),
          purpose: 'admin_settings_access',
          userRole: 'owner',
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setTestStatus('SUCCESS: Code verified. Step-up token issued.');
        setIsEnabled(true);
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
      <div className="p-6 bg-[#17120F] rounded-2xl border border-white/10 flex items-center justify-center space-x-2 text-stone-400">
        <RefreshCw className="w-4 h-4 animate-spin text-[#D4AF37]" />
        <span className="text-xs">Loading Security Status...</span>
      </div>
    );
  }

  return (
    <div className="bg-[#17120F] rounded-2xl border border-white/10 p-6 space-y-6 text-[#F7EFD9]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-[#6B1230] border border-[#D4AF37]/50 flex items-center justify-center shrink-0">
            <Lock className="w-5 h-5 text-[#D4AF37]" />
          </div>
          <div>
            <h3 className="text-base font-black text-white">Owner Security &amp; MFA Hardening</h3>
            <p className="text-xs text-[#F7EFD9]/60">
              RFC 6238 Time-based One-Time Password (TOTP) with replay defense and backup recovery codes.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {isEnabled ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
              <ShieldCheck className="w-3.5 h-3.5" /> Enforced &amp; Active
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
              <ShieldAlert className="w-3.5 h-3.5" /> Setup Required
            </span>
          )}
        </div>
      </div>

      {/* Main Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left: TOTP Key & Status */}
        <div className="space-y-4">
          <div>
            <span className="text-xs font-bold text-stone-300 block mb-1">
              Authenticator App Setup (Google Authenticator / 1Password)
            </span>
            <p className="text-[11px] text-stone-400 leading-relaxed mb-3">
              Add your manual secret key into your authenticator app to generate rotating 30-second codes:
            </p>
            <div className="flex items-center space-x-2 bg-black/60 p-2.5 rounded-xl border border-white/10 font-mono text-xs">
              <span className="text-[#D4AF37] tracking-wider truncate select-all flex-1">
                {setupSecret || 'BASE32-SECRET-ENROLLED'}
              </span>
              <button
                type="button"
                onClick={handleCopySecret}
                className="p-1.5 hover:bg-white/10 rounded-lg text-stone-400 hover:text-white"
                title="Copy Key"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <div>
            <span className="text-xs font-bold text-stone-300 block mb-1">
              Active Backup Recovery Codes
            </span>
            <p className="text-[11px] text-stone-400 mb-2">
              Single-use break-glass codes for emergency access when phone is unreachable:
            </p>
            <div className="p-3 bg-black/40 rounded-xl border border-white/10 text-xs font-mono text-[#D4AF37] space-y-1">
              <span className="text-stone-300 font-bold block">
                {backupCount > 0 ? `${backupCount} Unused Codes Available` : `${backupCodes.length} Generated Codes`}
              </span>
              <div className="grid grid-cols-2 gap-1 text-[11px] text-stone-400 pt-1">
                {backupCodes.slice(0, 4).map((c, i) => (
                  <span key={i}>{c}</span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Step-Up Test Box */}
        <div className="bg-black/30 p-5 rounded-xl border border-white/10 space-y-4">
          <div>
            <span className="text-xs font-bold text-white flex items-center gap-1.5 mb-1">
              <KeyRound className="w-3.5 h-3.5 text-[#D4AF37]" />
              <span>Verify Step-Up Authorization</span>
            </span>
            <p className="text-[11px] text-stone-400 leading-relaxed mb-3">
              Test your 6-digit authenticator code or enter a backup code to verify step-up clearance:
            </p>
          </div>

          <div className="space-y-3">
            <input
              type="text"
              maxLength={10}
              value={testCode}
              onChange={(e) => setTestCode(e.target.value.toUpperCase())}
              placeholder="e.g. 123456 or XXXX-XXXX"
              className="w-full text-center tracking-widest text-base font-mono py-2 px-3 bg-black/60 border border-white/20 rounded-xl text-white focus:outline-none focus:border-[#D4AF37]"
            />

            <button
              type="button"
              onClick={handleVerifyTestCode}
              disabled={verifying || !testCode.trim()}
              className="w-full py-2.5 bg-[#6B1230] hover:bg-[#85163c] text-white font-bold text-xs rounded-xl shadow transition-colors flex items-center justify-center space-x-1.5 disabled:opacity-50"
            >
              {verifying ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5 text-[#D4AF37]" />}
              <span>Test Step-Up Challenge</span>
            </button>

            {testStatus && (
              <div
                className={`p-2.5 rounded-lg text-xs font-semibold ${
                  testStatus.startsWith('SUCCESS')
                    ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/40'
                    : 'bg-rose-950/60 text-rose-300 border border-rose-500/40'
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
