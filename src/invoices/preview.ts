/**
 * ROCK UC FOODS - Customer Invoice Preview (Read-Only, Non-Mutating)
 * Playbook v2 Section 31.6 ("Preview as the customer before sending an invoice")
 */

import { invoiceRepository, estimateRepository } from './repository';
import { buildShareMessage, cleanFirstName } from './share';
import { requireRole, UserProfile } from '../lib/auth/access';
import { formatNaira } from '../lib/money';
import { InvoiceStatus } from './types';

export interface CustomerInvoicePreview {
  publicRef: string;
  revision: number;
  status: InvoiceStatus;
  customerFirstName: string;
  guests: number;
  lines: Array<{
    name: string;
    quantity: number;
    formattedUnitPrice: string;
    formattedLineTotal: string;
  }>;
  formattedTotal: string;
  formattedDeposit: string;
  formattedBalance: string;
  label?: string;
  expiresAt?: string;
  whatsAppMessagePreview: string;
  isDraftNotice: boolean;
}

/**
 * Generates a read-only preview of how the customer will see the invoice
 * and WhatsApp message, WITHOUT minting a share token or mutating repository state.
 */
export function buildCustomerInvoicePreview(
  publicRef: string,
  actor: UserProfile
): CustomerInvoicePreview {
  requireRole(['owner', 'staff', 'developer'], actor, 'preview customer invoice', publicRef);

  const invoice = invoiceRepository.getByPublicRef(publicRef);
  if (!invoice) {
    const err = new Error(`Invoice '${publicRef}' not found.`);
    (err as any).statusCode = 404;
    throw err;
  }

  const estimate = estimateRepository.getById(invoice.estimateId);
  const firstName = cleanFirstName(estimate?.contactName);

  const whatsAppMessagePreview = buildShareMessage({
    firstName,
    publicRef: invoice.publicRef,
    totalKobo: invoice.totalKobo,
    depositKobo: invoice.depositKobo,
    balanceKobo: invoice.balanceKobo,
    invoiceLink: `[30-day private invoice link for ${invoice.publicRef}]`,
  });

  return {
    publicRef: invoice.publicRef,
    revision: invoice.revision,
    status: invoice.status,
    customerFirstName: firstName,
    guests: estimate?.inputs?.guests || 0,
    lines: invoice.lines.map((line) => ({
      name: line.name,
      quantity: line.quantity,
      formattedUnitPrice: formatNaira(BigInt(line.unitPriceKobo)),
      formattedLineTotal: formatNaira(BigInt(line.lineTotalKobo)),
    })),
    formattedTotal: formatNaira(invoice.totalKobo),
    formattedDeposit: formatNaira(invoice.depositKobo),
    formattedBalance: formatNaira(invoice.balanceKobo),
    label: invoice.label,
    expiresAt: estimate?.validUntil,
    whatsAppMessagePreview,
    isDraftNotice: invoice.status === 'draft',
  };
}
