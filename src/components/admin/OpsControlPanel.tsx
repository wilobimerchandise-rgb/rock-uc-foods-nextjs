'use client';

/**
 * ROCK UC FOODS - Operational Kill Switches, Bank Details, Alerts & Drills Control Panel
 * Playbook v2 Section 31.6, Section 31.3 Finding 6 & Section 35
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  BANK_NAME,
  ACCOUNT_NAME,
  ACCOUNT_NUMBER,
} from '../../lib/businessSettings';
import {
  Power,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  ShieldCheck,
  Building,
  Play,
  FileCheck2,
  UserX,
  Clock,
  Check,
} from 'lucide-react';

interface OpsKillSwitches {
  invoiceRequestsPaused: boolean;
  whatsappSendPaused: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
}

interface OpsBankSettings {
  bankName: string;
  accountNumber: string;
  accountName: string;
  verifiedByOwner: boolean;
  updatedAt: string;
  updatedBy: string;
}

interface StaleDraftItem {
  invoiceId: string;
  publicRef: string;
  createdAt: string;
  waitingMinutes: number;
  alreadyAlerted: boolean;
}

interface OperationalAlertItem {
  id: string;
  type: 'stale_draft_invoice' | 'audit_write_failure' | 'kill_switch_activated';
  severity: 'warning' | 'critical';
  message: string;
  entityId: string;
  publicRef?: string;
  waitingMinutes?: number;
  createdAt: string;
}

interface DrillStepResult {
  name: string;
  passed: boolean;
  detail: string;
}

interface SelfCheckReport {
  checkedCount: number;
  skippedVoidCount: number;
  mismatchCount: number;
  passed: boolean;
  checkedAt: string;
}

interface NdpaPruneReport {
  redactedOrders: number;
  redactedEstimates: number;
  redactedNotifications: number;
  cutoffIso: string;
}

export interface OpsControlPanelProps {
  currentUserRole: 'owner' | 'staff' | 'developer';
  hasMfaVerified?: boolean;
}

export function OpsControlPanel({
  currentUserRole,
  hasMfaVerified = false,
}: OpsControlPanelProps) {
  const canRead = currentUserRole === 'owner' || currentUserRole === 'developer';
  const canMutate = currentUserRole === 'owner' && hasMfaVerified;

  const [loading, setLoading] = useState<boolean>(canRead);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [killSwitches, setKillSwitches] = useState<OpsKillSwitches>({
    invoiceRequestsPaused: false,
    whatsappSendPaused: false,
    updatedAt: null,
    updatedBy: null,
  });
  const [switchReason, setSwitchReason] = useState('Owner dashboard operational update');

  const [bankSettings, setBankSettings] = useState<OpsBankSettings | null>(null);
  const [bankNameInput, setBankNameInput] = useState(BANK_NAME);
  const [accountNumberInput, setAccountNumberInput] = useState(ACCOUNT_NUMBER);
  const [accountNameInput, setAccountNameInput] = useState(ACCOUNT_NAME);
  const [bankVerifiedInput, setBankVerifiedInput] = useState(true);

  const [staleDrafts, setStaleDrafts] = useState<StaleDraftItem[]>([]);
  const [auditFailureCount, setAuditFailureCount] = useState(0);
  const [recentAlerts, setRecentAlerts] = useState<OperationalAlertItem[]>([]);

  const [drillSteps, setDrillSteps] = useState<DrillStepResult[] | null>(null);
  const [selfCheckReport, setSelfCheckReport] = useState<SelfCheckReport | null>(null);
  const [ndpaReport, setNdpaReport] = useState<NdpaPruneReport | null>(null);

  const applyBankSettingsPayload = useCallback((nextBank: OpsBankSettings | null) => {
    setBankSettings(nextBank);
    if (nextBank) {
      setBankNameInput(nextBank.bankName || '');
      setAccountNumberInput(nextBank.accountNumber || '');
      setAccountNameInput(nextBank.accountName || '');
      setBankVerifiedInput(Boolean(nextBank.verifiedByOwner));
    } else {
      setBankNameInput('');
      setAccountNumberInput('');
      setAccountNameInput('');
      setBankVerifiedInput(false);
    }
  }, []);

  const loadStatus = useCallback(async () => {
    if (!canRead) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/admin/ops', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to load operational status.');
      }
      if (data.killSwitches) setKillSwitches(data.killSwitches);
      applyBankSettingsPayload(data.bankSettings ?? null);
      setStaleDrafts(Array.isArray(data.staleDrafts) ? data.staleDrafts : []);
      setAuditFailureCount(Number(data.auditFailureCount || 0));
      setRecentAlerts(Array.isArray(data.recentAlerts) ? data.recentAlerts : []);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Unable to fetch operational status.');
    } finally {
      setLoading(false);
    }
  }, [canRead, applyBankSettingsPayload]);

  useEffect(() => {
    if (!canRead) return;
    let active = true;

    async function initialFetch() {
      try {
        const res = await fetch('/api/admin/ops', { cache: 'no-store' });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Failed to load operational status.');
        }
        if (!active) return;
        if (data.killSwitches) setKillSwitches(data.killSwitches);
        applyBankSettingsPayload(data.bankSettings ?? null);
        setStaleDrafts(Array.isArray(data.staleDrafts) ? data.staleDrafts : []);
        setAuditFailureCount(Number(data.auditFailureCount || 0));
        setRecentAlerts(Array.isArray(data.recentAlerts) ? data.recentAlerts : []);
      } catch (err: any) {
        if (active) {
          setErrorMsg(err?.message || 'Unable to fetch operational status.');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void initialFetch();
    return () => {
      active = false;
    };
  }, [canRead, applyBankSettingsPayload]);

  const executeAction = async (action: string, payload: Record<string, unknown> = {}) => {
    if (!canMutate) return;
    setBusyAction(action);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch('/api/admin/ops', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...payload }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Operational action '${action}' failed.`);
      }

      if (action === 'toggle_switches' && data.killSwitches) {
        setKillSwitches(data.killSwitches);
        setSuccessMsg('Kill switch state updated and audited.');
      } else if (action === 'update_bank_details') {
        applyBankSettingsPayload(data.bankSettings ?? null);
        setSuccessMsg(
          data.bankSettings?.verifiedByOwner
            ? `Business bank details verified & active (${data.bankSettings.bankName} · ${data.bankSettings.accountNumber}).`
            : data.bankSettings
            ? 'Business bank details saved as unverified; checkout & invoicing remain paused until confirmed by Owner.'
            : 'Business bank details cleared; checkout, invoice issuing, and sharing are paused.'
        );
      } else if (action === 'check_stale_drafts') {
        setStaleDrafts(Array.isArray(data.staleDrafts) ? data.staleDrafts : []);
        const count = Array.isArray(data.alertsDispatched) ? data.alertsDispatched.length : 0;
        setSuccessMsg(`Stale draft scan completed (${count} new alert(s) dispatched).`);
      } else if (action === 'run_drills' && data.drillResult) {
        setDrillSteps(data.drillResult.steps || []);
        setSuccessMsg(
          data.drillResult.allPassed
            ? 'All operational verification drills passed.'
            : 'One or more verification drills failed.'
        );
      } else if (action === 'nightly_self_check' && data.report) {
        setSelfCheckReport(data.report);
        setSuccessMsg(
          data.report.passed
            ? `Nightly self-check passed (${data.report.checkedCount} invoice(s) reconciled).`
            : `Self-check found ${data.report.mismatchCount} mismatch(es).`
        );
      } else if (action === 'ndpa_prune' && data.result) {
        setNdpaReport(data.result);
        setSuccessMsg('NDPA 90-day phone redaction completed.');
      }

      await loadStatus();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Operational command failed.');
    } finally {
      setBusyAction(null);
    }
  };

  if (!canRead) {
    return (
      <section
        aria-label="Operational Controls"
        className="bg-[var(--bg-card)] border border-[var(--border-card)] rounded-2xl p-6 space-y-2 text-[var(--text-primary)]"
      >
        <h2 className="text-lg font-bold text-[var(--text-primary)]">
          Operational Controls &amp; Drills
        </h2>
        <p className="text-sm text-[var(--text-body-muted)]">
          Operational kill switches, verified bank details, and resilience drills require Owner or Developer access.
        </p>
      </section>
    );
  }

  return (
    <section
      aria-label="Operational Controls & Live Verification"
      data-testid="ops-control-panel"
      className="space-y-6 text-[var(--text-primary)] min-w-0 max-w-full"
    >
      {/* Top Bar */}
      <div className="bg-[var(--bg-card)] border border-[var(--border-card)] rounded-2xl p-5 sm:p-6 space-y-5 min-w-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[var(--border-subtle-card)]">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-[var(--text-primary)]">
              Operational Kill Switches &amp; Resilience Controls
            </h2>
            <p className="text-sm text-[var(--text-body-muted)] mt-1">
              Manage live circuit breakers, owner-verified bank transfer details, &gt;2h stale draft checks, NDPA retention redaction, and fault drills.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadStatus()}
            disabled={loading}
            className="min-h-[44px] px-4 py-2 bg-[var(--bg-surface-muted)] border border-[var(--border-card)] hover:border-[var(--border-gold)] rounded-xl text-sm font-semibold text-[var(--text-primary)] inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0"
          >
            <RefreshCw className={`w-4 h-4 text-[var(--text-accent)] ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Status</span>
          </button>
        </div>

        {!canMutate && (
          <div
            role="status"
            className="p-3.5 rounded-xl bg-[var(--status-warning-bg)] border border-[var(--status-warning-border)] text-sm text-[var(--status-warning-text)]"
          >
            Read-only mode:{' '}
            {currentUserRole !== 'owner'
              ? 'Only the account Owner may modify kill switches, bank details, or trigger maintenance runs.'
              : 'Verify your second-factor TOTP code in the MFA panel above to unlock Owner operational actions.'}
          </div>
        )}

        {errorMsg && (
          <div
            role="alert"
            className="p-3.5 rounded-xl bg-[var(--status-danger-bg)] border border-[var(--status-danger-border)] text-sm text-[var(--status-danger-text)] flex items-center gap-2"
          >
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div
            role="status"
            className="p-3.5 rounded-xl bg-[var(--status-success-bg)] border border-[var(--status-success-border)] text-sm text-[var(--status-success-text)] flex items-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Metrics Summary Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm pt-1">
          <div className="p-3.5 rounded-xl bg-[var(--bg-surface-muted)] border border-[var(--border-subtle-card)]">
            <div className="text-[var(--text-body-muted)]">Invoice Requests</div>
            <div className="mt-1 font-mono price-tabular font-bold text-base text-[var(--text-primary)]">
              {killSwitches.invoiceRequestsPaused ? 'Paused (503)' : 'Active'}
            </div>
          </div>
          <div className="p-3.5 rounded-xl bg-[var(--bg-surface-muted)] border border-[var(--border-subtle-card)]">
            <div className="text-[var(--text-body-muted)]">WhatsApp Sending</div>
            <div className="mt-1 font-mono price-tabular font-bold text-base text-[var(--text-primary)]">
              {killSwitches.whatsappSendPaused ? 'Paused (503)' : 'Active'}
            </div>
          </div>
          <div className="p-3.5 rounded-xl bg-[var(--bg-surface-muted)] border border-[var(--border-subtle-card)]">
            <div className="text-[var(--text-body-muted)]">Stale Drafts (&gt; 2h)</div>
            <div className="mt-1 font-mono price-tabular font-bold text-base text-[var(--text-accent)]">
              {staleDrafts.length}
            </div>
          </div>
          <div className="p-3.5 rounded-xl bg-[var(--bg-surface-muted)] border border-[var(--border-subtle-card)]">
            <div className="text-[var(--text-body-muted)]">Audit Write Failures</div>
            <div className="mt-1 font-mono price-tabular font-bold text-base text-[var(--text-primary)]">
              {auditFailureCount}
            </div>
          </div>
        </div>
      </div>

      {/* Kill Switches & Verified Bank Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-w-0">
        {/* Circuit Breakers */}
        <div className="bg-[var(--bg-card)] border border-[var(--border-card)] rounded-2xl p-5 sm:p-6 space-y-4 min-w-0">
          <div className="flex items-center gap-2 pb-3 border-b border-[var(--border-subtle-card)]">
            <Power className="w-4 h-4 text-[var(--text-accent)] shrink-0" />
            <h3 className="text-base font-bold text-[var(--text-primary)]">
              Operational Kill Switches
            </h3>
          </div>

          <div className="space-y-3 text-sm">
            <label
              htmlFor="ops-pause-invoices"
              className="flex items-start justify-between gap-3 p-3.5 rounded-xl bg-[var(--bg-surface-muted)] border border-[var(--border-subtle-card)] cursor-pointer"
            >
              <div className="min-w-0">
                <div className="font-semibold text-[var(--text-primary)]">
                  Pause Customer Invoice Requests
                </div>
                <div className="text-[var(--text-body-muted)] mt-0.5 text-sm">
                  Returns HTTP 503 with direct WhatsApp fallback for urgent catering inquiries.
                </div>
              </div>
              <div className="relative w-11 h-11 shrink-0 flex items-center justify-center">
                <input
                  id="ops-pause-invoices"
                  type="checkbox"
                  checked={killSwitches.invoiceRequestsPaused}
                  disabled={!canMutate}
                  onChange={(e) =>
                    setKillSwitches((prev) => ({
                      ...prev,
                      invoiceRequestsPaused: e.target.checked,
                    }))
                  }
                  className="peer appearance-none w-11 h-11 rounded-lg bg-[var(--bg-card)] border border-[var(--border-card)] checked:bg-[#6B1230] checked:border-[#D4AF37] cursor-pointer disabled:opacity-50"
                />
                <Check
                  aria-hidden="true"
                  className="w-5 h-5 text-[#F7EFD9] pointer-events-none absolute opacity-0 peer-checked:opacity-100"
                />
              </div>
            </label>

            <label
              htmlFor="ops-pause-whatsapp"
              className="flex items-start justify-between gap-3 p-3.5 rounded-xl bg-[var(--bg-surface-muted)] border border-[var(--border-subtle-card)] cursor-pointer"
            >
              <div className="min-w-0">
                <div className="font-semibold text-[var(--text-primary)]">
                  Pause WhatsApp Invoice Sending
                </div>
                <div className="text-[var(--text-body-muted)] mt-0.5 text-sm">
                  Halts invoice WhatsApp link generation and WhatsApp outbox sends while keeping SMS active.
                </div>
              </div>
              <div className="relative w-11 h-11 shrink-0 flex items-center justify-center">
                <input
                  id="ops-pause-whatsapp"
                  type="checkbox"
                  checked={killSwitches.whatsappSendPaused}
                  disabled={!canMutate}
                  onChange={(e) =>
                    setKillSwitches((prev) => ({
                      ...prev,
                      whatsappSendPaused: e.target.checked,
                    }))
                  }
                  className="peer appearance-none w-11 h-11 rounded-lg bg-[var(--bg-card)] border border-[var(--border-card)] checked:bg-[#6B1230] checked:border-[#D4AF37] cursor-pointer disabled:opacity-50"
                />
                <Check
                  aria-hidden="true"
                  className="w-5 h-5 text-[#F7EFD9] pointer-events-none absolute opacity-0 peer-checked:opacity-100"
                />
              </div>
            </label>

            <div>
              <label htmlFor="ops-switch-reason" className="block text-[var(--text-primary)] font-semibold mb-1.5">
                Audit Reason (Required)
              </label>
              <input
                id="ops-switch-reason"
                type="text"
                value={switchReason}
                disabled={!canMutate}
                onChange={(e) => setSwitchReason(e.target.value)}
                placeholder="Reason for changing kill switch state"
                className="w-full min-h-[44px] px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-card)] rounded-xl text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-gold)]"
              />
            </div>

            <button
              type="button"
              disabled={!canMutate || busyAction === 'toggle_switches'}
              onClick={() =>
                void executeAction('toggle_switches', {
                  invoiceRequestsPaused: killSwitches.invoiceRequestsPaused,
                  whatsappSendPaused: killSwitches.whatsappSendPaused,
                  reason: switchReason,
                })
              }
              className="w-full min-h-[44px] py-2.5 px-4 bg-[#6B1230] hover:bg-[#85163C] disabled:opacity-45 text-[#F7EFD9] border border-[#D4AF37]/50 text-sm font-bold rounded-xl transition-colors"
            >
              {busyAction === 'toggle_switches' ? 'Applying Switches...' : 'Apply Kill Switches'}
            </button>
          </div>
        </div>

        {/* Owner-Verified Bank Details (Finding 6) */}
        <div className="bg-[var(--bg-card)] border border-[var(--border-card)] rounded-2xl p-5 sm:p-6 space-y-4 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[var(--border-subtle-card)]">
            <div className="flex items-center gap-2">
              <Building className="w-4 h-4 text-[var(--text-accent)] shrink-0" />
              <h3 className="text-base font-bold text-[var(--text-primary)]">
                Verified Bank Transfer Settings
              </h3>
            </div>
            <span
              className={`px-2.5 py-0.5 rounded-md text-sm font-mono price-tabular font-bold border ${
                bankSettings?.verifiedByOwner
                  ? 'bg-[var(--status-success-bg)] text-[var(--status-success-text)] border-[var(--status-success-border)]'
                  : 'bg-[var(--status-warning-bg)] text-[var(--status-warning-text)] border-[var(--status-warning-border)]'
              }`}
            >
              {bankSettings?.verifiedByOwner ? 'Owner Verified' : 'Unverified / Blocked'}
            </span>
          </div>

          {!bankSettings?.verifiedByOwner && (
            <div
              role="status"
              className="p-3 rounded-xl bg-[var(--status-warning-bg)] border border-[var(--status-warning-border)] text-sm text-[var(--status-warning-text)] flex items-start justify-between gap-3 flex-wrap"
            >
              <span>
                Checkout, invoice issuance, and WhatsApp sharing are blocked until Owner-verified bank transfer details are active.
              </span>
              {canMutate && (
                <button
                  type="button"
                  onClick={() => {
                    setBankNameInput(BANK_NAME);
                    setAccountNameInput(ACCOUNT_NAME);
                    setAccountNumberInput(ACCOUNT_NUMBER);
                    setBankVerifiedInput(true);
                  }}
                  className="min-h-[44px] px-3 py-1.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border-gold)] text-sm font-bold text-[var(--text-primary)] whitespace-nowrap"
                >
                  Load GTBank Preset ({ACCOUNT_NUMBER})
                </button>
              )}
            </div>
          )}

          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="ops-bank-name" className="block text-[var(--text-primary)] font-semibold mb-1.5">
                  Bank Name
                </label>
                <input
                  id="ops-bank-name"
                  type="text"
                  value={bankNameInput}
                  disabled={!canMutate}
                  onChange={(e) => setBankNameInput(e.target.value)}
                  className="w-full min-h-[44px] px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-card)] rounded-xl text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-gold)]"
                />
              </div>
              <div>
                <label htmlFor="ops-bank-number" className="block text-[var(--text-primary)] font-semibold mb-1.5">
                  Account Number (10 digits)
                </label>
                <input
                  id="ops-bank-number"
                  type="text"
                  inputMode="numeric"
                  maxLength={10}
                  value={accountNumberInput}
                  disabled={!canMutate}
                  onChange={(e) => setAccountNumberInput(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  className="w-full min-h-[44px] px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-card)] rounded-xl text-sm font-mono price-tabular text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-gold)]"
                />
              </div>
            </div>

            <div>
              <label htmlFor="ops-bank-account-name" className="block text-[var(--text-primary)] font-semibold mb-1.5">
                Account Name
              </label>
              <input
                id="ops-bank-account-name"
                type="text"
                value={accountNameInput}
                disabled={!canMutate}
                onChange={(e) => setAccountNameInput(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-card)] rounded-xl text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-gold)]"
              />
            </div>

            <label
              htmlFor="ops-bank-verified"
              className="flex items-center gap-2.5 text-sm text-[var(--text-primary)] cursor-pointer min-h-[44px]"
            >
              <div className="relative w-11 h-11 shrink-0 flex items-center justify-center">
                <input
                  id="ops-bank-verified"
                  type="checkbox"
                  checked={bankVerifiedInput}
                  disabled={!canMutate}
                  onChange={(e) => setBankVerifiedInput(e.target.checked)}
                  className="peer appearance-none w-11 h-11 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-card)] checked:bg-[#6B1230] checked:border-[#D4AF37] cursor-pointer disabled:opacity-50"
                />
                <Check
                  aria-hidden="true"
                  className="w-5 h-5 text-[#F7EFD9] pointer-events-none absolute opacity-0 peer-checked:opacity-100"
                />
              </div>
              <span>Confirmed by Owner (required before issuing or sharing invoices)</span>
            </label>

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                disabled={!canMutate || busyAction === 'update_bank_details'}
                onClick={() => {
                  const trimmedNum = accountNumberInput.trim();
                  if (!/^\d{10}$/.test(trimmedNum)) {
                    setErrorMsg('Nigerian NUBAN bank account number must be exactly 10 digits.');
                    return;
                  }
                  void executeAction('update_bank_details', {
                    bankName: bankNameInput,
                    accountNumber: trimmedNum,
                    accountName: accountNameInput,
                    verifiedByOwner: bankVerifiedInput,
                  });
                }}
                className="flex-1 min-h-[44px] py-2.5 px-4 bg-[#6B1230] hover:bg-[#85163C] disabled:opacity-45 text-[#F7EFD9] border border-[#D4AF37]/50 text-sm font-bold rounded-xl transition-colors whitespace-nowrap"
              >
                {busyAction === 'update_bank_details' ? 'Saving...' : 'Save Bank Details'}
              </button>
              <button
                type="button"
                disabled={!canMutate || busyAction === 'update_bank_details'}
                onClick={() => void executeAction('update_bank_details', { clear: true })}
                className="min-h-[44px] py-2.5 px-4 bg-[var(--bg-surface-muted)] hover:border-[var(--border-gold)] border border-[var(--border-card)] disabled:opacity-45 text-[var(--text-primary)] text-sm font-semibold rounded-xl transition-colors whitespace-nowrap"
              >
                Clear Bank Details
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Integrity, Drills, NDPA & Stale Draft Actions */}
      <div className="bg-[var(--bg-card)] border border-[var(--border-card)] rounded-2xl p-5 sm:p-6 space-y-5 min-w-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--border-subtle-card)]">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[var(--text-accent)] shrink-0" />
            <h3 className="text-base font-bold text-[var(--text-primary)]">
              Integrity Checks, NDPA Retention &amp; Verification Drills
            </h3>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
          <button
            type="button"
            disabled={!canMutate || busyAction !== null}
            onClick={() => void executeAction('check_stale_drafts', { forceResend: false })}
            className="min-h-[44px] py-2.5 px-4 bg-[var(--bg-surface-muted)] hover:border-[var(--border-gold)] border border-[var(--border-card)] disabled:opacity-45 rounded-xl font-semibold text-[var(--text-primary)] inline-flex items-center justify-center gap-2 whitespace-nowrap"
          >
            <Clock className="w-4 h-4 text-[var(--text-accent)] shrink-0" />
            <span>{busyAction === 'check_stale_drafts' ? 'Scanning...' : 'Check Stale Drafts'}</span>
          </button>

          <button
            type="button"
            disabled={!canMutate || busyAction !== null}
            onClick={() => void executeAction('nightly_self_check')}
            className="min-h-[44px] py-2.5 px-4 bg-[var(--bg-surface-muted)] hover:border-[var(--border-gold)] border border-[var(--border-card)] disabled:opacity-45 rounded-xl font-semibold text-[var(--text-primary)] inline-flex items-center justify-center gap-2 whitespace-nowrap"
          >
            <FileCheck2 className="w-4 h-4 text-[var(--text-accent)] shrink-0" />
            <span>{busyAction === 'nightly_self_check' ? 'Checking...' : 'Run Nightly Self-Check'}</span>
          </button>

          <button
            type="button"
            disabled={!canMutate || busyAction !== null}
            onClick={() => void executeAction('ndpa_prune', { retentionDays: 90 })}
            className="min-h-[44px] py-2.5 px-4 bg-[var(--bg-surface-muted)] hover:border-[var(--border-gold)] border border-[var(--border-card)] disabled:opacity-45 rounded-xl font-semibold text-[var(--text-primary)] inline-flex items-center justify-center gap-2 whitespace-nowrap"
          >
            <UserX className="w-4 h-4 text-[var(--text-accent)] shrink-0" />
            <span>{busyAction === 'ndpa_prune' ? 'Pruning...' : 'Run NDPA Redaction'}</span>
          </button>

          <button
            type="button"
            disabled={!canMutate || busyAction !== null}
            onClick={() => void executeAction('run_drills')}
            className="min-h-[44px] py-2.5 px-4 bg-[#6B1230] hover:bg-[#85163C] border border-[#D4AF37]/50 disabled:opacity-45 rounded-xl font-bold text-[#F7EFD9] inline-flex items-center justify-center gap-2 whitespace-nowrap"
          >
            <Play className="w-4 h-4 text-[#D4AF37] shrink-0" />
            <span>{busyAction === 'run_drills' ? 'Running Drills...' : 'Run Verification Drills'}</span>
          </button>
        </div>

        {/* Drill / Self-Check / NDPA Results */}
        {drillSteps && (
          <div className="space-y-2 pt-2 border-t border-[var(--border-subtle-card)] text-sm">
            <div className="font-semibold text-[var(--text-primary)]">
              Latest Verification Drill Results
            </div>
            <div className="divide-y divide-[var(--border-subtle-card)] border border-[var(--border-subtle-card)] rounded-xl bg-[var(--bg-surface-muted)]">
              {drillSteps.map((step) => (
                <div
                  key={step.name}
                  className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                >
                  <div className="font-mono text-[var(--text-primary)]">{step.name}</div>
                  <div className="flex items-center gap-3 text-right">
                    <span className="text-[var(--text-body-muted)]">{step.detail}</span>
                    <span
                      className={`font-mono font-bold ${
                        step.passed
                          ? 'text-[var(--text-money-positive)]'
                          : 'text-[var(--status-danger-text)]'
                      }`}
                    >
                      {step.passed ? 'PASS' : 'FAIL'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {selfCheckReport && (
          <div className="p-3.5 rounded-xl bg-[var(--bg-surface-muted)] border border-[var(--border-subtle-card)] text-sm flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="font-semibold text-[var(--text-primary)]">
                Nightly Invoice Self-Check:
              </span>{' '}
              <span className="font-mono price-tabular text-[var(--text-body-muted)]">
                {selfCheckReport.checkedCount} checked · {selfCheckReport.skippedVoidCount} void skipped · {selfCheckReport.mismatchCount} mismatch(es)
              </span>
            </div>
            <span
              className={`font-mono font-bold ${
                selfCheckReport.passed
                  ? 'text-[var(--text-money-positive)]'
                  : 'text-[var(--status-danger-text)]'
              }`}
            >
              {selfCheckReport.passed ? 'RECONCILED' : 'MISMATCH DETECTED'}
            </span>
          </div>
        )}

        {ndpaReport && (
          <div className="p-3.5 rounded-xl bg-[var(--bg-surface-muted)] border border-[var(--border-subtle-card)] text-sm flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="font-semibold text-[var(--text-primary)]">
                NDPA 90-Day Redaction:
              </span>{' '}
              <span className="font-mono price-tabular text-[var(--text-body-muted)]">
                {ndpaReport.redactedOrders} order(s) · {ndpaReport.redactedEstimates} estimate(s) · {ndpaReport.redactedNotifications} outbox record(s) redacted
              </span>
            </div>
            <span className="font-mono price-tabular text-[var(--text-body-muted)]">
              Cutoff {ndpaReport.cutoffIso.slice(0, 10)}
            </span>
          </div>
        )}
      </div>

      {/* Stale Drafts & Operational Alerts Table */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-w-0">
        <div className="bg-[var(--bg-card)] border border-[var(--border-card)] rounded-2xl p-5 sm:p-6 space-y-3 min-w-0">
          <h3 className="text-base font-bold text-[var(--text-primary)]">
            Stale Draft Invoices (&gt; 2 Hours)
          </h3>
          {staleDrafts.length === 0 ? (
            <p className="text-sm text-[var(--text-body-muted)]">
              No draft invoices have waited longer than 2 hours for review.
            </p>
          ) : (
            <div className="divide-y divide-[var(--border-subtle-card)] border border-[var(--border-subtle-card)] rounded-xl bg-[var(--bg-surface-muted)] text-sm">
              {staleDrafts.map((draft) => (
                <div
                  key={draft.invoiceId}
                  className="px-4 py-3 flex items-center justify-between gap-2"
                >
                  <div>
                    <div className="font-mono font-bold text-[var(--text-accent)]">
                      {draft.publicRef}
                    </div>
                    <div className="text-[var(--text-body-muted)] font-mono price-tabular">
                      Created {draft.createdAt.slice(0, 16).replace('T', ' ')}
                    </div>
                  </div>
                  <div className="text-right font-mono price-tabular">
                    <div className="text-[var(--status-warning-text)] font-bold">
                      {draft.waitingMinutes} min
                    </div>
                    <div className="text-[var(--text-body-muted)]">
                      {draft.alreadyAlerted ? 'Alerted' : 'Pending alert'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-[var(--bg-card)] border border-[var(--border-card)] rounded-2xl p-5 sm:p-6 space-y-3 min-w-0">
          <h3 className="text-base font-bold text-[var(--text-primary)]">
            Recent Operational Alerts (Zero PII)
          </h3>
          {recentAlerts.length === 0 ? (
            <p className="text-sm text-[var(--text-body-muted)]">
              No operational alerts recorded in this session yet.
            </p>
          ) : (
            <div className="divide-y divide-[var(--border-subtle-card)] border border-[var(--border-subtle-card)] rounded-xl bg-[var(--bg-surface-muted)] text-sm max-h-60 overflow-y-auto">
              {recentAlerts.map((alert) => (
                <div key={alert.id} className="px-4 py-3 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`font-mono font-bold ${
                        alert.severity === 'critical'
                          ? 'text-[var(--status-danger-text)]'
                          : 'text-[var(--status-warning-text)]'
                      }`}
                    >
                      {alert.type}
                    </span>
                    <span className="font-mono price-tabular text-[var(--text-body-muted)]">
                      {alert.createdAt.slice(11, 19)} UTC
                    </span>
                  </div>
                  <p className="text-[var(--text-primary)]">{alert.message}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
