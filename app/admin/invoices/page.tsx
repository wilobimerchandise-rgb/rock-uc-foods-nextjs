import React from 'react';
import Link from 'next/link';
import { privateMetadata } from '@/src/seo/metadata';
import { invoiceRepository, estimateRepository, invoiceLinksRepository } from '@/src/invoices/repository';
import { formatNaira } from '@/src/lib/money';
import { FileText, ChevronRight, Clock, Users } from 'lucide-react';

export const metadata = privateMetadata;
export const dynamic = 'force-dynamic';

export default async function AdminInvoicesPage() {
  const invoices = invoiceRepository.getAll();

  // Sort: drafts first, then newest first
  const sorted = [...invoices].sort((a, b) => {
    if (a.status === 'draft' && b.status !== 'draft') return -1;
    if (a.status !== 'draft' && b.status === 'draft') return 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#D4AF37]/20 pb-4">
        <div>
          <h1 className="text-2xl font-serif text-[#D4AF37] font-bold">Catering Invoices</h1>
          <p className="text-xs text-white/60">
            Review event estimates, issue draft invoices, and share confirmed invoices with clients.
          </p>
        </div>
        <div className="text-xs px-3 py-1.5 rounded-full bg-[#17120F] border border-[#D4AF37]/40 text-[#D4AF37] font-semibold self-start sm:self-auto">
          {invoices.length} Total {invoices.length === 1 ? 'Invoice' : 'Invoices'}
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="bg-[#17120F] border border-white/10 rounded-2xl p-12 text-center space-y-3">
          <FileText className="w-12 h-12 text-[#D4AF37]/40 mx-auto" />
          <h3 className="text-lg font-bold text-white">No invoices yet.</h3>
          <p className="text-xs text-white/60 max-w-sm mx-auto">
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
                className="group block bg-[#17120F] border border-white/10 hover:border-[#D4AF37]/50 rounded-xl p-4 transition-all"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-sm text-[#F7EFD9] group-hover:text-[#D4AF37] transition-colors">
                        {inv.publicRef}
                      </span>
                      {isDraft && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/40">
                          Draft
                        </span>
                      )}
                      {isIssued && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                          Issued
                        </span>
                      )}
                      {isVoid && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-red-500/20 text-red-300 border border-red-500/40">
                          Void
                        </span>
                      )}
                      {inv.label && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-purple-500/20 text-purple-300 border border-purple-500/40">
                          {inv.label}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-white/70">
                      Client: <span className="text-white font-medium">{estimate?.contactName || 'Valued Client'}</span>
                      {estimate?.contactPhone && (
                        <span className="text-white/40 ml-2">({estimate.contactPhone})</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-4 text-right">
                    <div>
                      <div className="text-sm font-bold text-[#D4AF37]">
                        {formatNaira(inv.totalKobo)}
                      </div>
                      <div className="text-[11px] text-white/50 flex items-center gap-2 sm:justify-end">
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {estimate?.inputs?.guests || 0} guests
                        </span>
                        {links.length > 0 && (
                          <span className="text-emerald-400">
                            • Shared {links.length}x
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-white/40 group-hover:text-[#D4AF37] group-hover:translate-x-0.5 transition-all" />
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
