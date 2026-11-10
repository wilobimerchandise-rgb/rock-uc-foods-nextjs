import React from 'react';
import { notFound } from 'next/navigation';
import { privateMetadata } from '@/src/seo/metadata';
import { invoiceRepository, estimateRepository, invoiceLinksRepository } from '@/src/invoices/repository';
import { isInvoiceAuthorizedByLinks } from '@/src/invoices/publicRef';
import { formatNaira } from '@/src/lib/money';
import { CustomerInvoiceView } from '@/src/components/invoices/CustomerInvoiceView';

export const metadata = privateMetadata;
export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ ref: string }>;
  searchParams: Promise<{ token?: string }>;
}

export default async function CustomerInvoicePage({
  params,
  searchParams,
}: PageProps) {
  const { ref } = await params;
  const { token } = await searchParams;

  // 1. Missing or short token gives 404
  if (!token || typeof token !== 'string' || token.length < 16) {
    notFound();
  }

  // 2. Find invoice by publicRef
  const invoice = invoiceRepository.getByPublicRef(ref);
  if (!invoice) {
    notFound();
  }

  // 3. Constant-time token verification (original token OR active 30-day link)
  const links = invoiceLinksRepository.getLinksByInvoiceId(invoice.id);
  const isAuthorized = isInvoiceAuthorizedByLinks(token, invoice.accessTokenHash, links);

  if (!isAuthorized) {
    notFound();
  }

  const estimate = estimateRepository.getById(invoice.estimateId);
  const pdfDownloadUrl = `/api/invoice/${encodeURIComponent(ref)}?token=${encodeURIComponent(token)}&download=true`;
  const whatsappProofUrl = `https://wa.me/2348033729125?text=${encodeURIComponent(
    `Hello Chef Esther, I have paid the deposit for invoice ${invoice.publicRef}. Please find my payment receipt attached.`
  )}`;

  return (
    <CustomerInvoiceView
      invoice={{
        publicRef: invoice.publicRef,
        revision: invoice.revision,
        status: invoice.status,
        customerName: estimate?.contactName || 'Valued Client',
        customerPhone: estimate?.contactPhone || '',
        lines: invoice.lines,
        formattedTotal: formatNaira(invoice.totalKobo),
        formattedDeposit: formatNaira(invoice.depositKobo),
        formattedBalance: formatNaira(invoice.balanceKobo),
        createdAt: invoice.createdAt,
        issuedAt: invoice.issuedAt,
        pdfDownloadUrl,
        whatsappProofUrl,
      }}
    />
  );
}
