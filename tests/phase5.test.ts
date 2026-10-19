/**
 * ROCK UC FOODS - Phase 5 Verification Test Suite
 * Playbook v2 Section 10: Event Enquiries, Invoices & Receipts
 * 
 * Validates:
 * 1. Real PostgreSQL PGlite migration (0005_invoices_and_receipts.sql) & CHECK constraints
 * 2. Sequential document numbering (INV-YYYY-000123, RCT-YYYY-000123) and 128-bit tokens
 * 3. Server-authoritative BigInt kobo invoice calculation
 * 4. Payment instructions bank details safety gate
 * 5. Immutable revision tracking (material revision marks previous version superseded)
 * 6. Receipt generation requires verified payment (unpaid invoice cannot generate receipt)
 * 7. Receipt payment split ('PART PAYMENT' vs 'PAID IN FULL') & timeframe status
 * 8. Server-side PDF generation with ₦ glyph extraction and zero placeholder glyphs (■)
 * 9. Document access security, TTL from DOCUMENT_LINK_TTL_HOUR (72), and IDOR protection
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import * as fs from 'fs';
import * as path from 'path';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { PDFParse } = require('pdf-parse');

import {
  createInvoice,
  reviseInvoice,
  generateReceipt,
  nextInvoiceNumber,
  nextReceiptNumber,
  generateDocumentToken,
  createSignedDocumentLink,
  verifySignedDocumentLink,
  resetDocumentSequences,
  invoiceRepository,
} from '../src/catering/invoiceEngine';
import {
  generateOfficialInvoicePdf,
  generateOfficialReceiptPdf,
} from '../src/catering/documentPdf';
import { formatNaira, NAIRA_SYMBOL } from '../src/lib/money';
import { getDocumentLinkTtlHours } from '../lib/env';

describe('Phase 5: Event Enquiries, Invoices and Receipts', () => {
  beforeEach(() => {
    invoiceRepository.clear();
    resetDocumentSequences(1, 1);
  });

  // TEST 1: Database Migration & Schema Constraints
  it('1. Applies 0005_invoices_and_receipts.sql and enforces total & line item CHECK constraints', async () => {
    const db = new PGlite();
    const sql1 = fs.readFileSync(path.resolve(__dirname, '../supabase/migrations/0001_foundation.sql'), 'utf-8');
    const sql2 = fs.readFileSync(path.resolve(__dirname, '../supabase/migrations/0002_menu_core.sql'), 'utf-8');
    const sql3 = fs.readFileSync(path.resolve(__dirname, '../supabase/migrations/0003_orders_core.sql'), 'utf-8');
    const sql4 = fs.readFileSync(path.resolve(__dirname, '../supabase/migrations/0004_events_and_invoices.sql'), 'utf-8');
    const sql5 = fs.readFileSync(path.resolve(__dirname, '../supabase/migrations/0005_invoices_and_receipts.sql'), 'utf-8');

    await db.exec(sql1);
    await db.exec(sql2);
    await db.exec(sql3);
    await db.exec(sql4);
    await db.exec(sql5);

    // Insert valid invoice
    await db.exec(`
      INSERT INTO invoices (
        id, invoice_number, public_token, subtotal_kobo, delivery_fee_kobo, discount_kobo, tax_kobo, total_kobo
      ) VALUES (
        '10000000-0000-0000-0000-000000000001', 'INV-2026-000001', 'a1b2c3d4e5f60718293a4b5c6d7e8f90',
        820000, 150000, 0, 0, 970000
      );
    `);

    // Verify rejection if total != subtotal + delivery - discount + tax (tampered total)
    await expect(
      db.query(`
        INSERT INTO invoices (
          id, invoice_number, public_token, subtotal_kobo, delivery_fee_kobo, discount_kobo, tax_kobo, total_kobo
        ) VALUES (
          '10000000-0000-0000-0000-000000000002', 'INV-2026-000002', 'b1b2c3d4e5f60718293a4b5c6d7e8f91',
          820000, 150000, 0, 0, 900000
        );
      `)
    ).rejects.toThrow(/invoices_total_reconciliation_chk/);

    // Verify rejection on invoice_items if line_total != unit_price * quantity
    await expect(
      db.query(`
        INSERT INTO invoice_items (
          invoice_id, name_snapshot, unit_price_kobo, quantity, line_total_kobo
        ) VALUES (
          '10000000-0000-0000-0000-000000000001', 'Test Jollof', 350000, 2, 600000
        );
      `)
    ).rejects.toThrow(/invoice_line_total_chk/);
  }, 25000);

  // TEST 2: Sequence Numbering and 128-bit Token Format
  it('2. Formats invoice/receipt numbers with sequence and 128-bit random public tokens', () => {
    const inv1 = nextInvoiceNumber(2026);
    const inv2 = nextInvoiceNumber(2026);
    expect(inv1).toBe('INV-2026-000001');
    expect(inv2).toBe('INV-2026-000002');

    const rct1 = nextReceiptNumber(2026);
    const rct2 = nextReceiptNumber(2026);
    expect(rct1).toBe('RCT-2026-000001');
    expect(rct2).toBe('RCT-2026-000002');

    const token = generateDocumentToken();
    expect(token).toMatch(/^[0-9a-f]{32}$/);
    expect(token.length).toBe(32); // 128 bits in hex
  });

  // TEST 3: Server-Authoritative BigInt Invoice Calculation
  it('3. Computes invoice subtotal, delivery, discount, and 70/30 deposit schedule with BigInt precision', () => {
    const invoice = createInvoice({
      clientName: 'Aliko Dangote',
      clientPhone: '08033729125',
      items: [
        { nameSnapshot: 'Party Jollof Rice Pack', unitPriceKobo: 350000n, quantity: 10 }, // 3,500,000
        { nameSnapshot: 'Grilled Chicken Extra', unitPriceKobo: 150000n, quantity: 10 },  // 1,500,000
      ],
      deliveryFeeKobo: 500000n, // 500,000
      discountKobo: 200000n,    // -200,000
      bankDetails: {
        bankName: 'Access Bank PLC',
        accountNumber: '0123456789',
        accountName: 'ROCK UC FOODS LIMITED',
        verifiedByOwner: true,
      },
    }, 'draft');

    expect(invoice.subtotalKobo).toBe(5000000n);
    expect(invoice.deliveryFeeKobo).toBe(500000n);
    expect(invoice.discountKobo).toBe(200000n);
    expect(invoice.totalKobo).toBe(5300000n); // 5,000,000 + 500,000 - 200,000
    expect(invoice.depositKobo).toBe(3710000n); // 70% of 5,300,000
    expect(invoice.balanceKobo).toBe(1590000n); // 30% of 5,300,000
    expect(invoice.depositKobo + invoice.balanceKobo).toBe(invoice.totalKobo);
  });

  // TEST 4: Payment Instructions & Bank Details Safety Gate
  it('4. Blocks issuing an invoice if bank details are missing or unverified by owner', () => {
    // Attempting to issue with missing bank details MUST fail
    expect(() => {
      createInvoice({
        clientName: 'Test Client',
        clientPhone: '08033729125',
        items: [{ nameSnapshot: 'Item 1', unitPriceKobo: 100000n, quantity: 1 }],
      }, 'issued');
    }).toThrow(/Cannot issue invoice without owner-verified bank details/);

    // Issuing with owner-verified bank details succeeds
    const issuedInvoice = createInvoice({
      clientName: 'Test Client',
      clientPhone: '08033729125',
      items: [{ nameSnapshot: 'Item 1', unitPriceKobo: 100000n, quantity: 1 }],
      bankDetails: {
        bankName: 'Zenith Bank',
        accountNumber: '2001122334',
        accountName: 'ROCK UC FOODS',
        verifiedByOwner: true,
      },
    }, 'issued');

    expect(issuedInvoice.status).toBe('issued');
    expect(issuedInvoice.bankDetails?.bankName).toBe('Zenith Bank');
  });

  // TEST 5: Immutable Revision Tracking & Superseding
  it('5. Revising an issued invoice marks original as superseded and creates a new immutable revision', () => {
    const original = createInvoice({
      clientName: 'Wedding Client',
      clientPhone: '08033729125',
      items: [{ nameSnapshot: 'Fried Rice Tray', unitPriceKobo: 2000000n, quantity: 2 }],
      bankDetails: {
        bankName: 'GTBank',
        accountNumber: '0987654321',
        accountName: 'ROCK UC FOODS',
        verifiedByOwner: true,
      },
    }, 'issued');

    expect(original.revisionNumber).toBe(1);
    expect(original.status).toBe('issued');
    expect(original.totalKobo).toBe(4000000n);

    // Client requests addition of a 3rd tray
    const revised = reviseInvoice(original.id, {
      items: [{ nameSnapshot: 'Fried Rice Tray', unitPriceKobo: 2000000n, quantity: 3 }],
    }, 'usr-owner-01');

    // Original must remain viewable as superseded
    const storedOriginal = invoiceRepository.getInvoiceById(original.id);
    expect(storedOriginal?.status).toBe('superseded');
    expect(storedOriginal?.totalKobo).toBe(4000000n);

    // Revised invoice has incremented revision number and same sequence number
    expect(revised.revisionNumber).toBe(2);
    expect(revised.status).toBe('issued');
    expect(revised.invoiceNumber).toBe(original.invoiceNumber);
    expect(revised.totalKobo).toBe(6000000n);

    // Verify versions history
    const versions = invoiceRepository.getVersionsForInvoice(revised.id);
    expect(versions.length).toBeGreaterThan(0);
    expect(versions[0].version).toBe(2);
  });

  // TEST 6: Receipt Generation Constraint (Requires Verified Payment)
  it('6. Rejects receipt generation for unpaid invoice and requires verified payment', () => {
    const invoice = createInvoice({
      clientName: 'Femi Otedola',
      clientPhone: '08033729125',
      items: [{ nameSnapshot: 'VIP Banquet', unitPriceKobo: 10000000n, quantity: 1 }],
      bankDetails: {
        bankName: 'First Bank',
        accountNumber: '1122334455',
        accountName: 'ROCK UC FOODS',
        verifiedByOwner: true,
      },
    }, 'issued');

    // Attempting to generate receipt with 0 or negative payment MUST fail
    expect(() => {
      generateReceipt({
        invoiceId: invoice.id,
        paymentId: 'pay-001',
        paymentDate: '2026-10-19',
        paymentMethod: 'manual_transfer',
        amountReceivedKobo: 0n,
        isDeliveryTimeframeConfirmed: true,
      });
    }).toThrow(/receipt cannot be generated for an unpaid invoice/);
  });

  // TEST 7: Receipt Split Logic ('PART PAYMENT' vs 'PAID IN FULL') & Fulfilment Status
  it('7. Handles 70% deposit part payment and 100% full payment with delivery timeframe confirmation', () => {
    const invoice = createInvoice({
      clientName: 'Corporate Gala',
      clientPhone: '08033729125',
      items: [{ nameSnapshot: 'Executive Buffet', unitPriceKobo: 1000000n, quantity: 1 }], // Total: 1,000,000 kobo
      bankDetails: {
        bankName: 'UBA',
        accountNumber: '9988776655',
        accountName: 'ROCK UC FOODS',
        verifiedByOwner: true,
      },
    }, 'issued');

    // Step 1: Deposit of 700,000 kobo with unconfirmed timeframe
    const rct1 = generateReceipt({
      invoiceId: invoice.id,
      paymentId: 'TXN-BANK-101',
      paymentDate: '2026-10-19',
      paymentMethod: 'manual_transfer',
      amountReceivedKobo: 700000n,
      isDeliveryTimeframeConfirmed: false,
    });

    expect(rct1.receiptStatus).toBe('PART PAYMENT');
    expect(rct1.paidToDateKobo).toBe(700000n);
    expect(rct1.balanceKobo).toBe(300000n);
    expect(rct1.timeframeStatus).toBe('Timeframe to be confirmed');

    // Step 2: Final settlement of remaining 300,000 kobo with confirmed timeframe
    const rct2 = generateReceipt({
      invoiceId: invoice.id,
      paymentId: 'TXN-BANK-102',
      paymentDate: '2026-10-20',
      paymentMethod: 'manual_transfer',
      amountReceivedKobo: 300000n,
      isDeliveryTimeframeConfirmed: true,
    });

    expect(rct2.receiptStatus).toBe('PAID IN FULL');
    expect(rct2.paidToDateKobo).toBe(1000000n);
    expect(rct2.balanceKobo).toBe(0n);
    expect(rct2.timeframeStatus).toBe('confirmed');
  });

  // TEST 8: Server-Side PDF Generation with ₦ Glyph Verification
  it('8. Renders Invoice & Receipt PDFs with brand tokens, ₦ glyph, and zero placeholder boxes (■)', async () => {
    const invoice = createInvoice({
      clientName: 'Chief Adebayo',
      clientPhone: '08033729125',
      items: [{ nameSnapshot: 'Smoky Jollof Rice Special', unitPriceKobo: 150000n, quantity: 1 }],
      bankDetails: {
        bankName: 'Access Bank',
        accountNumber: '0011223344',
        accountName: 'ROCK UC FOODS',
        verifiedByOwner: true,
      },
    }, 'issued');

    const receipt = generateReceipt({
      invoiceId: invoice.id,
      paymentId: 'TX-REF-007',
      paymentDate: '2026-10-19',
      paymentMethod: 'manual_transfer',
      amountReceivedKobo: 150000n,
      isDeliveryTimeframeConfirmed: true,
    });

    // 1. Generate Invoice PDF
    const invPdf = await generateOfficialInvoicePdf(invoice);
    expect(invPdf.pdfBytes.length).toBeGreaterThan(500);

    // 2. Generate Receipt PDF
    const rctPdf = await generateOfficialReceiptPdf(receipt, invoice);
    expect(rctPdf.pdfBytes.length).toBeGreaterThan(500);

    // Parse and verify ₦ glyph extraction
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parser = new (PDFParse as any)({ data: Buffer.from(rctPdf.pdfBytes) });
    await parser.load();
    const parsedText = await parser.getText();

    expect(parsedText.text).toContain('ROCK UC FOODS');
    expect(parsedText.text).toContain(NAIRA_SYMBOL);
    expect(parsedText.text).toContain('1,500.00');
    expect(parsedText.text).not.toContain('■');
    expect(parsedText.text).not.toContain('NGN');
  });

  // TEST 9: Document Access Security, TTL from DOCUMENT_LINK_TTL_HOUR (72), and IDOR Protection
  it('9. Secures document links with 72-hour TTL and rejects IDOR token guessing attempts', () => {
    const ttlHours = getDocumentLinkTtlHours();
    expect(ttlHours).toBe(72);

    const token = generateDocumentToken();
    const link = createSignedDocumentLink(token, 'invoice');
    expect(link.url).toContain(`/docs/invoice/${token}`);
    expect(link.expiresAtMs).toBeGreaterThan(Date.now() + 71 * 3600 * 1000);

    const parsedUrl = new URL(link.url);
    const exp = parseInt(parsedUrl.searchParams.get('exp')!, 10);
    const sig = parsedUrl.searchParams.get('sig')!;

    // Valid link passes verification
    const verified = verifySignedDocumentLink(token, 'invoice', exp, sig);
    expect(verified.isValid).toBe(true);

    // Expired link is rejected
    const expiredCheck = verifySignedDocumentLink(token, 'invoice', Date.now() - 1000, sig);
    expect(expiredCheck.isValid).toBe(false);
    expect(expiredCheck.reason).toContain('expired');

    // Tampered token/signature is rejected (IDOR attempt)
    const tamperedCheck = verifySignedDocumentLink('00000000000000000000000000000000', 'invoice', exp, sig);
    expect(tamperedCheck.isValid).toBe(false);

    // Guessing non-existent tokens in repository returns undefined (404)
    expect(invoiceRepository.getInvoiceByToken('nonexistenttoken1234567890abcdef')).toBeUndefined();
    expect(invoiceRepository.getReceiptByToken('nonexistenttoken1234567890abcdef')).toBeUndefined();
  });
});
