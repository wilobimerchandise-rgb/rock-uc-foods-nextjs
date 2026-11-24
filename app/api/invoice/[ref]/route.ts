/**
 * ROCK UC FOODS - Customer Invoice Access API
 * Playbook Phase 1D Section 5
 * 
 * Rules:
 * - Constant-time comparison of token hash.
 * - Wrong, missing, or unknown ref returns the EXACT same 404 response (no information leak).
 * - Draft: returns 'Your invoice is being reviewed by Chef Esther' with estimate figures and NO PDF.
 * - Issued: provides PDF download.
 * - Headers: Cache-Control: no-store, X-Robots-Tag: noindex.
 * - Token never logged or audited.
 */

import { NextRequest, NextResponse } from 'next/server';
import { invoiceRepository, estimateRepository, invoiceLinksRepository } from '@/src/invoices/repository';
import { verifyTokenHash } from '@/src/invoices/publicRef';
import { renderInvoicePdfBuffer, InvoicePdfData } from '@/src/lib/pdf/InvoiceDocument';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ ref: string }> }
) {
  const { ref } = await params;
  const { searchParams } = new URL(req.url);
  const token = searchParams.get('token');
  const download = searchParams.get('download') === 'true';

  const notFoundResponse = () =>
    NextResponse.json(
      { error: 'Invoice not found.' },
      {
        status: 404,
        headers: {
          'Cache-Control': 'no-store',
          'X-Robots-Tag': 'noindex',
        },
      }
    );

  // 1. Missing token gives 404
  if (!token || typeof token !== 'string' || token.length < 16) {
    return notFoundResponse();
  }

  // 2. Find invoice by publicRef
  const invoice = invoiceRepository.getByPublicRef(ref);
  if (!invoice) {
    return notFoundResponse();
  }

  // 3. Constant-time token verification (accept original token OR any valid non-expired, non-revoked link)
  let isAuthorized = verifyTokenHash(token, invoice.accessTokenHash);

  if (!isAuthorized) {
    const links = invoiceLinksRepository.getLinksByInvoiceId(invoice.id);
    const now = Date.now();
    for (const link of links) {
      if (link.revokedAt) continue;
      if (new Date(link.expiresAt).getTime() < now) continue;

      if (verifyTokenHash(token, link.tokenHash)) {
        isAuthorized = true;
        break;
      }
    }
  }

  if (!isAuthorized) {
    return notFoundResponse();
  }


  // Common security headers
  const securityHeaders = {
    'Cache-Control': 'no-store',
    'X-Robots-Tag': 'noindex',
  };

  // 4. Draft: show review notice and figures, NO PDF!
  if (invoice.status === 'draft') {
    return NextResponse.json(
      {
        status: 'draft',
        publicRef: invoice.publicRef,
        message: 'Your invoice is being reviewed by Chef Esther',
        lines: invoice.lines,
        totalKobo: invoice.totalKobo.toString(),
        depositKobo: invoice.depositKobo.toString(),
        balanceKobo: invoice.balanceKobo.toString(),
        hasPdf: false,
        label: invoice.label,
        createdAt: invoice.createdAt,
      },
      {
        status: 200,
        headers: securityHeaders,
      }
    );
  }

  // 5. Void status
  if (invoice.status === 'void') {
    return NextResponse.json(
      {
        status: 'void',
        publicRef: invoice.publicRef,
        message: 'This invoice has been voided.',
        hasPdf: false,
      },
      {
        status: 200,
        headers: securityHeaders,
      }
    );
  }

  // 6. Issued: Generate PDF if download requested
  if (download) {
    const estimate = estimateRepository.getById(invoice.estimateId);
    const linesSumKobo = invoice.lines.reduce(
      (sum, l) => sum + BigInt(l.unitPriceKobo) * BigInt(l.quantity),
      0n
    );
    const estDeliveryKobo = estimate?.result?.logisticsKobo
      ? BigInt(estimate.result.logisticsKobo)
      : 0n;
    const estServiceKobo = estimate?.result?.serviceChargeKobo
      ? BigInt(estimate.result.serviceChargeKobo)
      : 0n;

    let deliveryFeeKobo = estDeliveryKobo;
    let serviceChargeKobo = estServiceKobo;
    if (linesSumKobo + deliveryFeeKobo + serviceChargeKobo !== invoice.totalKobo) {
      const remaining = invoice.totalKobo - linesSumKobo;
      if (remaining >= 0n) {
        deliveryFeeKobo = remaining >= estDeliveryKobo ? estDeliveryKobo : remaining;
        serviceChargeKobo = remaining - deliveryFeeKobo;
      } else {
        deliveryFeeKobo = 0n;
        serviceChargeKobo = 0n;
      }
    }

    const pdfData: InvoicePdfData = {
      invoiceNumber: invoice.publicRef,
      revision: invoice.revision,
      clientName: estimate?.contactName || 'Valued Client',
      clientPhone: estimate?.contactPhone || '+2348033729125',
      clientEmail: estimate?.contactEmail,
      items: invoice.lines.map((l) => ({
        name: l.name,
        quantity: l.quantity,
        unitPriceKobo: BigInt(l.unitPriceKobo),
      })),
      deliveryFeeKobo,
      serviceChargeKobo,
    };

    const pdfBuffer = await renderInvoicePdfBuffer(pdfData);

    return new NextResponse(pdfBuffer as any, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${invoice.publicRef}.pdf"`,
        ...securityHeaders,
      },
    });
  }

  // Issued metadata
  return NextResponse.json(
    {
      status: 'issued',
      publicRef: invoice.publicRef,
      lines: invoice.lines,
      totalKobo: invoice.totalKobo.toString(),
      depositKobo: invoice.depositKobo.toString(),
      balanceKobo: invoice.balanceKobo.toString(),
      hasPdf: true,
      pdfUrl: `/api/invoice/${encodeURIComponent(invoice.publicRef)}?token=${encodeURIComponent(token)}&download=true`,
      issuedAt: invoice.issuedAt,
    },
    {
      status: 200,
      headers: securityHeaders,
    }
  );
}
