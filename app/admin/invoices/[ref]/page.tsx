import React from 'react';
import { notFound } from 'next/navigation';
import { privateMetadata } from '@/src/seo/metadata';
import { globalAuthService, getProfileFromService } from '@/src/auth/wiring';
import { invoiceRepository, estimateRepository, invoiceLinksRepository, invoiceVersionsRepository } from '@/src/invoices/repository';
import { formatNaira } from '@/src/lib/money';
import { getEstimatorConfig } from '@/src/estimator/config';
import { AdminInvoiceDetailClient } from '@/src/components/admin/AdminInvoiceDetailClient';

export const metadata = privateMetadata;
export const dynamic = 'force-dynamic';

export default async function AdminInvoiceDetailPage({
  params,
}: {
  params: Promise<{ ref: string }>;
}) {
  const { ref } = await params;

  // 1. Fetch user session
  const sessionRes = await globalAuthService.getSession();
  const user = sessionRes.session?.user;
  const profile = user ? await getProfileFromService(user.id) : null;
  const userRole = profile?.role || 'staff';

  // 2. Fetch invoice from database
  const invoice = invoiceRepository.getByPublicRef(ref);
  if (!invoice) {
    notFound();
  }

  const estimate = estimateRepository.getById(invoice.estimateId);
  const links = invoiceLinksRepository.getLinksByInvoiceId(invoice.id);
  const versions = invoiceVersionsRepository.getVersionsByInvoiceId(invoice.id);
  const config = getEstimatorConfig();

  const serializedInvoice = {
    id: invoice.id,
    publicRef: invoice.publicRef,
    revision: invoice.revision,
    status: invoice.status,
    customerName: estimate?.contactName || 'Valued Client',
    customerPhone: estimate?.contactPhone || '',
    customerEmail: estimate?.contactEmail,
    packageId: estimate?.inputs?.packageId || 'tier-bronze',
    guests: estimate?.inputs?.guests || 0,
    zoneId: estimate?.inputs?.zoneId,
    addOnIds: estimate?.inputs?.addOnIds || [],
    lines: invoice.lines,
    totalKobo: invoice.totalKobo.toString(),
    formattedTotal: formatNaira(invoice.totalKobo),
    depositKobo: invoice.depositKobo.toString(),
    formattedDeposit: formatNaira(invoice.depositKobo),
    balanceKobo: invoice.balanceKobo.toString(),
    formattedBalance: formatNaira(invoice.balanceKobo),
    label: invoice.label,
    createdAt: invoice.createdAt,
    expiresAt: estimate?.validUntil,
    issuedAt: invoice.issuedAt,
    voidReason: invoice.voidReason,
    revisedAt: invoice.revisedAt,
    revisionReason: invoice.revisionReason,
    linksCount: links.length,
    lastSharedAt: links[0]?.createdAt,
    versions: versions.map((v) => ({
      id: v.id,
      revision: v.revision,
      reason: v.reason,
      changedAt: v.changedAt,
      formattedTotal: formatNaira(v.snapshot.totalKobo),
      formattedDeposit: formatNaira(v.snapshot.depositKobo),
      formattedBalance: formatNaira(v.snapshot.balanceKobo),
    })),
  };

  const serializedConfig = {
    tiers: config.tiers.map((t) => ({
      id: t.id,
      name: t.name,
      pricePerGuestKobo: t.pricePerGuestKobo.toString(),
      formattedPrice: formatNaira(t.pricePerGuestKobo),
      minGuests: t.minGuests,
      maxGuests: t.maxGuests,
    })),
    addOns: config.addOns?.map((a) => ({
      id: a.id,
      name: a.name,
      flatPriceKobo: a.unitPriceKobo.toString(),
      formattedPrice: formatNaira(a.unitPriceKobo),
    })) || [],
    zones: [],
  };

  return <AdminInvoiceDetailClient invoice={serializedInvoice} userRole={userRole} config={serializedConfig} />;
}
