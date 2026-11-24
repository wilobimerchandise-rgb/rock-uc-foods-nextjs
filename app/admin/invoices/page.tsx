import React from 'react';
import Link from 'next/link';
import { privateMetadata } from '@/src/seo/metadata';
import { invoiceRepository, estimateRepository, invoiceLinksRepository } from '@/src/invoices/repository';
import { formatNaira } from '@/src/lib/money';
import {
  getProfileFromService,
  resolveSessionFromRequest,
  hasSessionVerifiedMfa,
} from '@/src/auth/wiring';
import { maskCustomerPhone } from '@/src/lib/security';
import { FileText, ChevronRight, Clock, Users } from 'lucide-react';

export const metadata = privateMetadata;
export const dynamic = 'force-dynamic';

export default async function AdminInvoicesPage() {
  const sessionRes = await resolveSessionFromRequest();
  const user = sessionRes.session?.user;
  const profile = user ? await getProfileFromService(user.id) : null;
  const userRole = profile?.role || 'staff';
  const hasMfaVerified = hasSessionVerifiedMfa(sessionRes.session, profile?.hasMfaVerified);

  const invoices = invoiceRepository.getAll();

  // Sort: drafts first, then newest first
  const sorted = [...invoices].sort((a, b) => {
    if (a.status === 'draft' && b.status !== 'draft') return -1;
    if (a.status !== 'draft' && b.status === 'draft') return 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 sm:py-8 space-y-6 min-w-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--border-card)] pb-4">
        <div>
          <h1 className="text-2xl font-serif text-[var(--text-accent)] font-bold">
            Catering Invoices
          </h1>
          <p className="text-sm text-[var(--text-body-muted)] mt-1">
            Review event estimates, issue draft invoices, and share confirmed invoices with clients.
          </p>
        </div>
        <div className="text-sm px-3.5 py-2 rounded-lg bg-[var(--bg-card)] border border-[var(--border-card)] text-[var(--text-accent)] font-semibold self-start sm:self-auto price-tabular">
          {invoices.length} Total {invoices.length === 1 ? 'Invoice' : 'Invoices'}
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="bg-[var(--bg-card)] border border-[var(--border-subtle-card)] rounded-2xl p-10 text-center space-y-3">
          <FileText className="w-12 h-12 text-[var(--text-accent)] mx-auto" />
          <h2 className="text-lg font-bold text-[var(--text-primary)]">No invoices yet.</h2>
          <p className="text-sm text-[var(--text-body-muted)] max-w-sm mx-auto">
            When clients request official invoices from the catering estimator, they will appear here as drafts for your review.
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {sorted.map((inv) => {
            const estimate = estimateRepository.getById(inv.estimateId);
            const links = invoiceLinksRepository.getLinksByInvoiceId(inv.id);
            const isDraft = inv.status === 'draft';
            const isIssued = inv.status === 'issued';
            const isVoid = inv.status === 'void';

            return (
              <Link
                key={inv.id}
                href={`/admin/invoices/${encodeURIComponent(inv.publicRef)}`}
                className="group block min-h-[44px] bg-[var(--bg-card)] border border-[var(--border-subtle-card)] hover:border-[var(--border-gold)] rounded-xl p-4 transition-all"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-sm text-[var(--text-primary)] group-hover:text-[var(--text-accent)] transition-colors">
                        {inv.publicRef}
                      </span>
                      {isDraft && (
                        <span className="px-2.5 py-0.5 rounded text-sm font-bold uppercase bg-[var(--status-warning-bg)] text-[var(--status-warning-text)] border border-[var(--status-warning-border)]">
                          Draft
                        </span>
                      )}
                      {isIssued && (
                        <span className="px-2.5 py-0.5 rounded text-sm font-bold uppercase bg-[var(--status-success-bg)] text-[var(--status-success-text)] border border-[var(--status-success-border)]">
                          Issued
                        </span>
                      )}
                      {isVoid && (
                        <span className="px-2.5 py-0.5 rounded text-sm font-bold uppercase bg-[var(--status-danger-bg)] text-[var(--status-danger-text)] border border-[var(--status-danger-border)]">
                          Void
                        </span>
                      )}
                      {inv.label && (
                        <span className="px-2.5 py-0.5 rounded text-sm font-medium bg-[var(--status-info-bg)] text-[var(--status-info-text)] border border-[var(--status-info-border)]">
                          {inv.label}
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-[var(--text-body-muted)]">
                      Client:{' '}
                      <span className="text-[var(--text-primary)] font-medium">
                        {estimate?.contactName || 'Valued Client'}
                      </span>
                      {estimate?.contactPhone && (
                        <span className="text-[var(--text-body-muted)] ml-2 font-mono price-tabular">
                          ({maskCustomerPhone(estimate.contactPhone, userRole, hasMfaVerified)})
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-4 text-right shrink-0">
                    <div>
                      <div className="text-base font-bold text-[var(--text-accent)] price-tabular">
                        {formatNaira(inv.totalKobo)}
                      </div>
                      <div className="text-sm text-[var(--text-body-muted)] flex items-center gap-2 sm:justify-end">
                        <span className="flex items-center gap-1">
                          <Users className="w-4 h-4 shrink-0" />
                          <span>{estimate?.inputs?.guests || 0} guests</span>
                        </span>
                        {links.length > 0 && (
                          <span className="text-[var(--text-money-positive)] font-medium">
                            • Shared {links.length}x
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-[var(--text-body-muted)] group-hover:text-[var(--text-accent)] group-hover:translate-x-0.5 transition-all" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
