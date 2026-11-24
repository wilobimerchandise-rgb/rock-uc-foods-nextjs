'use client';

/**
 * ROCK UC FOODS - Site Content CMS Editor
 * Phase 2A / Playbook v9 Section 25 & Section 35
 *
 * Wired to GET/POST /api/admin/content with:
 * - Optimistic locking (expectedVersion -> 409 Conflict reload recovery)
 * - Owner + verified 2FA gate on writes (staff sees read-only notice)
 * - Strict customer quote permission confirmation checkbox
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  DEFAULT_SITE_CONTENT,
  ReviewContent,
  SectionContent,
  SiteContent,
  SiteContentVersion,
} from '../../content/types';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock,
  FileText,
  Lock,
  MessageSquareQuote,
  Phone,
  Plus,
  RefreshCw,
  Save,
  Trash2,
} from 'lucide-react';

export interface SiteContentManagerProps {
  currentUserRole: 'owner' | 'staff' | 'developer';
  hasMfaVerified?: boolean;
  initialVersion?: SiteContentVersion;
}

function cloneSiteContent(c: SiteContent): SiteContent {
  return {
    contact: { ...c.contact },
    hours: { ...c.hours },
    sections: c.sections.map((s) => ({ ...s })),
    reviews: c.reviews.map((r) => ({ ...r })),
  };
}

export const SiteContentManager: React.FC<SiteContentManagerProps> = ({
  currentUserRole,
  hasMfaVerified = false,
  initialVersion,
}) => {
  const canMutate = currentUserRole === 'owner' && hasMfaVerified;

  const [version, setVersion] = useState<number>(initialVersion?.version ?? 1);
  const [lastUpdatedMeta, setLastUpdatedMeta] = useState<{
    createdAt: string;
    createdBy: string;
    note?: string;
  } | null>(
    initialVersion
      ? {
          createdAt: initialVersion.createdAt,
          createdBy: initialVersion.createdBy,
          note: initialVersion.note,
        }
      : null
  );
  const [content, setContent] = useState<SiteContent>(() =>
    cloneSiteContent(initialVersion?.content ?? DEFAULT_SITE_CONTENT)
  );
  const [changeNote, setChangeNote] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(!initialVersion);
  const [saving, setSaving] = useState<boolean>(false);
  const [conflictDetected, setConflictDetected] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
    details?: string[];
  } | null>(null);

  const loadLatestContent = useCallback(async () => {
    setLoading(true);
    setConflictDetected(false);
    try {
      const res = await fetch('/api/admin/content', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to load site content.');
      }
      setVersion(Number(data.version || 1));
      setContent(cloneSiteContent(data.content || DEFAULT_SITE_CONTENT));
      setLastUpdatedMeta({
        createdAt: data.createdAt || new Date().toISOString(),
        createdBy: data.createdBy || 'owner@rockucfoods.com',
        note: data.note,
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.message || 'Unable to load current site content.',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialVersion) return;
    let active = true;
    async function initialFetch() {
      try {
        const res = await fetch('/api/admin/content', { cache: 'no-store' });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.error || 'Failed to load site content.');
        }
        if (!active) return;
        setVersion(Number(data.version || 1));
        setContent(cloneSiteContent(data.content || DEFAULT_SITE_CONTENT));
        setLastUpdatedMeta({
          createdAt: data.createdAt || new Date().toISOString(),
          createdBy: data.createdBy || 'owner@rockucfoods.com',
          note: data.note,
        });
      } catch (err: any) {
        if (active) {
          setFeedback({
            type: 'error',
            message: err?.message || 'Unable to load current site content.',
          });
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
  }, [initialVersion]);

  const updateContact = <K extends keyof SiteContent['contact']>(
    field: K,
    value: SiteContent['contact'][K]
  ) => {
    setContent((prev) => ({
      ...prev,
      contact: {
        ...prev.contact,
        [field]: value,
      },
    }));
  };

  const updateHours = <K extends keyof SiteContent['hours']>(
    field: K,
    value: SiteContent['hours'][K]
  ) => {
    setContent((prev) => ({
      ...prev,
      hours: {
        ...prev.hours,
        [field]: value,
      },
    }));
  };

  const updateSection = (
    idx: number,
    patch: Partial<SectionContent>
  ) => {
    setContent((prev) => ({
      ...prev,
      sections: prev.sections.map((sec, i) => (i === idx ? { ...sec, ...patch } : sec)),
    }));
  };

  const addReview = () => {
    if (content.reviews.length >= 30) {
      setFeedback({
        type: 'error',
        message: 'Maximum limit of 30 customer reviews reached.',
      });
      return;
    }
    setContent((prev) => ({
      ...prev,
      reviews: [
        ...prev.reviews,
        {
          quote: '',
          name: '',
          dateText: new Date().toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }),
          permissionConfirmed: false,
        },
      ],
    }));
  };

  const updateReview = (idx: number, patch: Partial<ReviewContent>) => {
    setContent((prev) => ({
      ...prev,
      reviews: prev.reviews.map((rev, i) => (i === idx ? { ...rev, ...patch } : rev)),
    }));
  };

  const removeReview = (idx: number) => {
    setContent((prev) => ({
      ...prev,
      reviews: prev.reviews.filter((_, i) => i !== idx),
    }));
  };

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canMutate) {
      setFeedback({
        type: 'error',
        message: 'Only owner sessions with verified 2FA (MFA) can publish site content changes.',
      });
      return;
    }

    const unconfirmed = content.reviews.filter((r) => !r.permissionConfirmed);
    if (unconfirmed.length > 0) {
      setFeedback({
        type: 'error',
        message: 'Every customer review must have explicit permission confirmation checked before publishing.',
      });
      return;
    }

    setSaving(true);
    setFeedback(null);
    setConflictDetected(false);

    try {
      const res = await fetch('/api/admin/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          expectedVersion: version,
          note: changeNote.trim() || 'Admin CMS update',
        }),
      });
      const data = await res.json();

      if (res.status === 409) {
        setConflictDetected(true);
        setFeedback({
          type: 'error',
          message:
            data?.error ||
            'Another edit was saved since you loaded this page. Reload latest content before retrying.',
        });
        return;
      }

      if (!res.ok) {
        setFeedback({
          type: 'error',
          message: data?.error || 'Validation failed.',
          details: Array.isArray(data?.errors) ? data.errors : undefined,
        });
        return;
      }

      setVersion(Number(data.version || version + 1));
      setContent(cloneSiteContent(data.content || content));
      setLastUpdatedMeta({
        createdAt: data.createdAt || new Date().toISOString(),
        createdBy: data.createdBy || 'owner@rockucfoods.com',
        note: data.note,
      });
      setChangeNote('');
      setFeedback({
        type: 'success',
        message: `Published site content version v${data.version} and revalidated public pages.`,
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.message || 'Network error saving site content.',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="bg-[var(--bg-primary)] text-[var(--text-primary)] p-4 md:p-6 max-w-5xl mx-auto space-y-6 min-w-0 w-full max-w-full"
      data-testid="site-content-manager"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[var(--border-subtle-card)]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-serif font-bold text-[var(--text-primary)]">
              Site Content CMS
            </h1>
            <span className="text-sm font-mono font-bold px-2.5 py-0.5 rounded-md bg-[var(--bg-card)] border border-[var(--border-gold)] text-[var(--text-accent)] price-tabular">
              Version v{version}
            </span>
          </div>
          <p className="text-sm text-[var(--text-body-muted)] mt-1">
            Manage public contact details, Lagos kitchen hours &amp; lead time, menu section headings, and verified customer reviews.
          </p>
          {lastUpdatedMeta && (
            <p className="text-sm text-[var(--text-body-muted)] mt-1">
              Last saved: {new Date(lastUpdatedMeta.createdAt).toLocaleString()}
              {lastUpdatedMeta.note ? ` — "${lastUpdatedMeta.note}"` : ''}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={loadLatestContent}
          disabled={loading}
          className="min-h-[44px] min-w-[44px] bg-[var(--bg-card)] border border-[var(--border-card)] text-[var(--text-primary)] px-4 py-2 rounded-xl text-sm font-semibold hover:border-[var(--border-gold)] inline-flex items-center gap-2 shrink-0"
        >
          <RefreshCw className={`w-4 h-4 text-[var(--text-accent)] shrink-0 ${loading ? 'animate-spin' : ''}`} />
          <span>Reload Latest</span>
        </button>
      </div>

      {/* Role & MFA Gate Banner */}
      {!canMutate && (
        <div
          role="status"
          className="p-4 rounded-xl bg-[var(--status-warning-bg)] border border-[var(--status-warning-border)] text-[var(--status-warning-text)] text-sm flex items-start gap-3"
        >
          <Lock className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold block">Read-Only Preview (Owner + Verified 2FA Required to Publish)</span>
            <span>
              {currentUserRole !== 'owner'
                ? `Current role "${currentUserRole}" can inspect published site copy, but only Owner sessions may modify public business content.`
                : 'Your Owner session must complete 2FA / MFA step-up verification in Security & MFA before publishing changes.'}
            </span>
          </div>
        </div>
      )}

      {/* Feedback & 409 Conflict Banner */}
      {feedback && (
        <div
          role={feedback.type === 'error' ? 'alert' : 'status'}
          className={`p-4 rounded-xl text-sm border space-y-2 ${
            feedback.type === 'error'
              ? 'bg-[var(--status-danger-bg)] text-[var(--status-danger-text)] border-[var(--status-danger-border)]'
              : 'bg-[var(--status-success-bg)] text-[var(--status-success-text)] border-[var(--status-success-border)]'
          }`}
        >
          <div className="flex items-start gap-2 font-semibold">
            {feedback.type === 'error' ? (
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
            )}
            <span>{feedback.message}</span>
          </div>
          {feedback.details && feedback.details.length > 0 && (
            <ul className="list-disc pl-6 space-y-1">
              {feedback.details.map((d, idx) => (
                <li key={idx}>{d}</li>
              ))}
            </ul>
          )}
          {conflictDetected && (
            <div className="pt-1">
              <button
                type="button"
                onClick={loadLatestContent}
                className="min-h-[44px] px-4 py-2 rounded-lg bg-[#6B1230] text-[#F7EFD9] border border-[#D4AF37]/60 text-sm font-semibold inline-flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" /> Load Latest Content Version
              </button>
            </div>
          )}
        </div>
      )}

      <form onSubmit={handlePublish} className="space-y-6">
        {/* 1. Contact & Visibility */}
        <section className="bg-[var(--bg-card)] border border-[var(--border-card)] rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-[var(--border-subtle-card)]">
            <Phone className="w-5 h-5 text-[var(--text-accent)] shrink-0" />
            <h2 className="text-lg font-serif font-bold text-[var(--text-primary)]">
              1. Public Contact &amp; Visibility
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="cms-whatsapp" className="block text-sm font-semibold text-[var(--text-accent)] mb-1">
                WhatsApp Number (Nigerian E.164 or 080...)
              </label>
              <input
                id="cms-whatsapp"
                type="text"
                required
                disabled={!canMutate}
                value={content.contact.whatsapp}
                onChange={(e) => updateContact('whatsapp', e.target.value)}
                className="w-full min-h-[44px] bg-[var(--bg-primary)] border border-[var(--border-card)] rounded-xl px-3.5 py-2 text-sm font-mono price-tabular text-[var(--text-primary)] disabled:opacity-70"
              />
            </div>

            <div>
              <label htmlFor="cms-phone" className="block text-sm font-semibold text-[var(--text-accent)] mb-1">
                Public Display Phone
              </label>
              <input
                id="cms-phone"
                type="text"
                required
                disabled={!canMutate}
                value={content.contact.phone}
                onChange={(e) => updateContact('phone', e.target.value)}
                className="w-full min-h-[44px] bg-[var(--bg-primary)] border border-[var(--border-card)] rounded-xl px-3.5 py-2 text-sm font-mono price-tabular text-[var(--text-primary)] disabled:opacity-70"
              />
            </div>

            <div>
              <label htmlFor="cms-email" className="block text-sm font-semibold text-[var(--text-accent)] mb-1">
                Business Email
              </label>
              <input
                id="cms-email"
                type="email"
                disabled={!canMutate}
                value={content.contact.email}
                onChange={(e) => updateContact('email', e.target.value)}
                className="w-full min-h-[44px] bg-[var(--bg-primary)] border border-[var(--border-card)] rounded-xl px-3.5 py-2 text-sm text-[var(--text-primary)] disabled:opacity-70"
              />
              <label htmlFor="cms-show-email" className="flex items-center gap-3 mt-2 cursor-pointer min-h-[44px]">
                <div className="relative w-11 h-11 shrink-0 flex items-center justify-center">
                  <input
                    id="cms-show-email"
                    type="checkbox"
                    disabled={!canMutate}
                    checked={content.contact.showEmail}
                    onChange={(e) => updateContact('showEmail', e.target.checked)}
                    className="peer appearance-none w-11 h-11 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-card)] checked:bg-[#6B1230] checked:border-[#D4AF37] cursor-pointer disabled:opacity-60"
                  />
                  <Check
                    aria-hidden="true"
                    className="w-5 h-5 text-[#F7EFD9] pointer-events-none absolute opacity-0 peer-checked:opacity-100"
                  />
                </div>
                <span className="text-sm text-[var(--text-primary)]">Display business email publicly</span>
              </label>
            </div>

            <div>
              <label htmlFor="cms-address" className="block text-sm font-semibold text-[var(--text-accent)] mb-1">
                Collection Address (Service City: Lagos)
              </label>
              <input
                id="cms-address"
                type="text"
                maxLength={160}
                disabled={!canMutate}
                value={content.contact.address}
                onChange={(e) => updateContact('address', e.target.value)}
                className="w-full min-h-[44px] bg-[var(--bg-primary)] border border-[var(--border-card)] rounded-xl px-3.5 py-2 text-sm text-[var(--text-primary)] disabled:opacity-70"
              />
              <label htmlFor="cms-show-address" className="flex items-center gap-3 mt-2 cursor-pointer min-h-[44px]">
                <div className="relative w-11 h-11 shrink-0 flex items-center justify-center">
                  <input
                    id="cms-show-address"
                    type="checkbox"
                    disabled={!canMutate}
                    checked={content.contact.showAddress}
                    onChange={(e) => updateContact('showAddress', e.target.checked)}
                    className="peer appearance-none w-11 h-11 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-card)] checked:bg-[#6B1230] checked:border-[#D4AF37] cursor-pointer disabled:opacity-60"
                  />
                  <Check
                    aria-hidden="true"
                    className="w-5 h-5 text-[#F7EFD9] pointer-events-none absolute opacity-0 peer-checked:opacity-100"
                  />
                </div>
                <span className="text-sm text-[var(--text-primary)]">Display kitchen street address publicly</span>
              </label>
            </div>
          </div>
        </section>

        {/* 2. Hours & Lead Time */}
        <section className="bg-[var(--bg-card)] border border-[var(--border-card)] rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-[var(--border-subtle-card)]">
            <Clock className="w-5 h-5 text-[var(--text-accent)] shrink-0" />
            <h2 className="text-lg font-serif font-bold text-[var(--text-primary)]">
              2. Kitchen Hours &amp; Lead Time
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
            <div>
              <label htmlFor="cms-lead-time" className="block text-sm font-semibold text-[var(--text-accent)] mb-1">
                Standard Lead Time (1–168 Hours)
              </label>
              <input
                id="cms-lead-time"
                type="number"
                min={1}
                max={168}
                step={1}
                required
                disabled={!canMutate}
                value={content.hours.leadTimeHours}
                onChange={(e) => updateHours('leadTimeHours', Number(e.target.value) || 24)}
                className="w-full min-h-[44px] bg-[var(--bg-primary)] border border-[var(--border-card)] rounded-xl px-3.5 py-2 text-sm font-mono price-tabular text-[var(--text-primary)] disabled:opacity-70"
              />
            </div>

            <label htmlFor="cms-open-247" className="flex items-center gap-3 md:pt-7 cursor-pointer min-h-[44px]">
              <div className="relative w-11 h-11 shrink-0 flex items-center justify-center">
                <input
                  id="cms-open-247"
                  type="checkbox"
                  disabled={!canMutate}
                  checked={content.hours.orderingOpen247}
                  onChange={(e) => updateHours('orderingOpen247', e.target.checked)}
                  className="peer appearance-none w-11 h-11 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-card)] checked:bg-[#6B1230] checked:border-[#D4AF37] cursor-pointer disabled:opacity-60"
                />
                <Check
                  aria-hidden="true"
                  className="w-5 h-5 text-[#F7EFD9] pointer-events-none absolute opacity-0 peer-checked:opacity-100"
                />
              </div>
              <span className="text-sm text-[var(--text-primary)] font-medium">
                Online checkout open 24/7 for scheduled preparation
              </span>
            </label>
          </div>

          <div>
            <label htmlFor="cms-kitchen-note" className="block text-sm font-semibold text-[var(--text-accent)] mb-1">
              Kitchen Operating Note (max 200 chars)
            </label>
            <textarea
              id="cms-kitchen-note"
              rows={2}
              maxLength={200}
              disabled={!canMutate}
              value={content.hours.kitchenNote}
              onChange={(e) => updateHours('kitchenNote', e.target.value)}
              className="w-full min-h-[64px] bg-[var(--bg-primary)] border border-[var(--border-card)] rounded-xl p-3 text-sm text-[var(--text-primary)] disabled:opacity-70"
            />
          </div>
        </section>

        {/* 3. Menu Section Headings */}
        <section className="bg-[var(--bg-card)] border border-[var(--border-card)] rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-[var(--border-subtle-card)]">
            <FileText className="w-5 h-5 text-[var(--text-accent)] shrink-0" />
            <h2 className="text-lg font-serif font-bold text-[var(--text-primary)]">
              3. Curated Menu Section Titles
            </h2>
          </div>

          <div className="space-y-3">
            {content.sections.map((sec, idx) => (
              <div
                key={sec.categorySlug}
                className="grid grid-cols-1 md:grid-cols-12 gap-3 p-3.5 rounded-xl bg-[var(--bg-surface-muted)] border border-[var(--border-subtle-card)]"
              >
                <div className="md:col-span-3">
                  <span className="block text-sm font-semibold text-[var(--text-body-muted)] mb-1">
                    Slug
                  </span>
                  <div className="min-h-[44px] flex items-center px-3 rounded-lg bg-[var(--bg-card)] border border-[var(--border-card)] font-mono text-sm text-[var(--text-accent)]">
                    {sec.categorySlug}
                  </div>
                </div>
                <div className="md:col-span-4">
                  <label
                    htmlFor={`cms-sec-display-${idx}`}
                    className="block text-sm font-semibold text-[var(--text-accent)] mb-1"
                  >
                    Luxury Display Title
                  </label>
                  <input
                    id={`cms-sec-display-${idx}`}
                    type="text"
                    required
                    maxLength={40}
                    disabled={!canMutate}
                    value={sec.displayName}
                    onChange={(e) => updateSection(idx, { displayName: e.target.value })}
                    className="w-full min-h-[44px] bg-[var(--bg-primary)] border border-[var(--border-card)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] disabled:opacity-70"
                  />
                </div>
                <div className="md:col-span-3">
                  <label
                    htmlFor={`cms-sec-plain-${idx}`}
                    className="block text-sm font-semibold text-[var(--text-accent)] mb-1"
                  >
                    Plain Helper Label
                  </label>
                  <input
                    id={`cms-sec-plain-${idx}`}
                    type="text"
                    required
                    maxLength={60}
                    disabled={!canMutate}
                    value={sec.plainLabel}
                    onChange={(e) => updateSection(idx, { plainLabel: e.target.value })}
                    className="w-full min-h-[44px] bg-[var(--bg-primary)] border border-[var(--border-card)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] disabled:opacity-70"
                  />
                </div>
                <div className="md:col-span-2">
                  <label
                    htmlFor={`cms-sec-sort-${idx}`}
                    className="block text-sm font-semibold text-[var(--text-accent)] mb-1"
                  >
                    Order
                  </label>
                  <input
                    id={`cms-sec-sort-${idx}`}
                    type="number"
                    min={1}
                    max={99}
                    disabled={!canMutate}
                    value={sec.sortOrder}
                    onChange={(e) => updateSection(idx, { sortOrder: Number(e.target.value) || idx + 1 })}
                    className="w-full min-h-[44px] bg-[var(--bg-primary)] border border-[var(--border-card)] rounded-lg px-3 py-2 text-sm font-mono price-tabular text-[var(--text-primary)] disabled:opacity-70"
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 4. Verified Customer Reviews */}
        <section className="bg-[var(--bg-card)] border border-[var(--border-card)] rounded-2xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-[var(--border-subtle-card)]">
            <div className="flex items-center gap-2">
              <MessageSquareQuote className="w-5 h-5 text-[var(--text-accent)] shrink-0" />
              <h2 className="text-lg font-serif font-bold text-[var(--text-primary)]">
                4. Verified Customer Reviews ({content.reviews.length}/30)
              </h2>
            </div>

            {canMutate && (
              <button
                type="button"
                onClick={addReview}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-[var(--bg-surface-muted)] border border-[var(--border-gold)] text-[var(--text-primary)] text-sm font-semibold inline-flex items-center gap-1.5 hover:opacity-90"
              >
                <Plus className="w-4 h-4 text-[var(--text-accent)]" /> Add Verified Review
              </button>
            )}
          </div>

          {content.reviews.length === 0 ? (
            <p className="text-sm text-[var(--text-body-muted)] p-4 rounded-xl bg-[var(--bg-surface-muted)] border border-[var(--border-subtle-card)]">
              No public customer reviews published yet. Only quotes with explicit customer permission confirmation are permitted.
            </p>
          ) : (
            <div className="space-y-4">
              {content.reviews.map((rev, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-xl bg-[var(--bg-surface-muted)] border border-[var(--border-card)] space-y-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold text-[var(--text-accent)]">
                      Review #{idx + 1}
                    </span>
                    {canMutate && (
                      <button
                        type="button"
                        onClick={() => removeReview(idx)}
                        aria-label={`Remove review ${idx + 1}`}
                        className="min-h-[44px] min-w-[44px] px-3 rounded-lg bg-[var(--status-danger-bg)] border border-[var(--status-danger-border)] text-[var(--status-danger-text)] text-sm font-semibold inline-flex items-center gap-1.5"
                      >
                        <Trash2 className="w-4 h-4" /> Remove
                      </button>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor={`cms-rev-quote-${idx}`}
                      className="block text-sm font-semibold text-[var(--text-accent)] mb-1"
                    >
                      Customer Quote (1–400 chars)
                    </label>
                    <textarea
                      id={`cms-rev-quote-${idx}`}
                      rows={2}
                      required
                      maxLength={400}
                      disabled={!canMutate}
                      value={rev.quote}
                      onChange={(e) => updateReview(idx, { quote: e.target.value })}
                      className="w-full min-h-[64px] bg-[var(--bg-primary)] border border-[var(--border-card)] rounded-lg p-3 text-sm text-[var(--text-primary)] disabled:opacity-70"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label
                        htmlFor={`cms-rev-name-${idx}`}
                        className="block text-sm font-semibold text-[var(--text-accent)] mb-1"
                      >
                        Customer Name (max 60 chars)
                      </label>
                      <input
                        id={`cms-rev-name-${idx}`}
                        type="text"
                        required
                        maxLength={60}
                        disabled={!canMutate}
                        value={rev.name}
                        onChange={(e) => updateReview(idx, { name: e.target.value })}
                        className="w-full min-h-[44px] bg-[var(--bg-primary)] border border-[var(--border-card)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] disabled:opacity-70"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor={`cms-rev-date-${idx}`}
                        className="block text-sm font-semibold text-[var(--text-accent)] mb-1"
                      >
                        Date Text (max 20 chars)
                      </label>
                      <input
                        id={`cms-rev-date-${idx}`}
                        type="text"
                        maxLength={20}
                        disabled={!canMutate}
                        value={rev.dateText}
                        onChange={(e) => updateReview(idx, { dateText: e.target.value })}
                        className="w-full min-h-[44px] bg-[var(--bg-primary)] border border-[var(--border-card)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] disabled:opacity-70"
                      />
                    </div>
                  </div>

                  <label
                    htmlFor={`cms-rev-perm-${idx}`}
                    className="flex items-center gap-3 pt-1 cursor-pointer min-h-[44px]"
                  >
                    <div className="relative w-11 h-11 shrink-0 flex items-center justify-center">
                      <input
                        id={`cms-rev-perm-${idx}`}
                        type="checkbox"
                        disabled={!canMutate}
                        checked={rev.permissionConfirmed}
                        onChange={(e) =>
                          updateReview(idx, { permissionConfirmed: e.target.checked })
                        }
                        className="peer appearance-none w-11 h-11 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-card)] checked:bg-[#6B1230] checked:border-[#D4AF37] cursor-pointer disabled:opacity-60"
                      />
                      <Check
                        aria-hidden="true"
                        className="w-5 h-5 text-[#F7EFD9] pointer-events-none absolute opacity-0 peer-checked:opacity-100"
                      />
                    </div>
                    <span className="text-sm font-semibold text-[var(--text-primary)]">
                      I confirm the customer explicitly consented to publish this review quote.
                    </span>
                  </label>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Commit Bar */}
        <section className="bg-[var(--bg-card)] border border-[var(--border-gold)] rounded-2xl p-5 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="flex-1 min-w-0">
            <label htmlFor="cms-change-note" className="block text-sm font-semibold text-[var(--text-accent)] mb-1">
              Audit Change Note
            </label>
            <input
              id="cms-change-note"
              type="text"
              maxLength={200}
              disabled={!canMutate}
              placeholder="e.g. Updated holiday kitchen hours & verified client quote"
              value={changeNote}
              onChange={(e) => setChangeNote(e.target.value)}
              className="w-full min-h-[44px] bg-[var(--bg-primary)] border border-[var(--border-card)] rounded-xl px-3.5 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] disabled:opacity-70"
            />
          </div>

          <button
            type="submit"
            disabled={!canMutate || saving}
            className={`min-h-[44px] px-6 py-2.5 rounded-xl font-bold text-sm inline-flex items-center justify-center gap-2 shrink-0 ${
              canMutate && !saving
                ? 'btn-luxury'
                : 'bg-[var(--bg-surface-muted)] text-[var(--text-body-muted)] border border-[var(--border-card)] opacity-60 cursor-not-allowed'
            }`}
          >
            <Save className="w-4 h-4 shrink-0" />
            <span>{saving ? 'Publishing...' : `Publish Site Content (v${version + 1})`}</span>
          </button>
        </section>
      </form>
    </div>
  );
};
