/**
 * ROCK UC FOODS - Official Invoice & Receipt PDF Generator
 * Playbook v2 Section 10 (Phase 5)
 * 
 * Rules:
 * - Server-side, A4 format, phone readable.
 * - Same brand tokens as website:
 *     Invoice header band = Wine (#6B1230) with title "INVOICE".
 *     Receipt header band = Purple (#5B2A6E) with title "RECEIPT".
 *     Cream paper background (#F7EFD9).
 *     Gold hairline divider (#D4AF37).
 * - Real embedded TTF font rendering the Naira glyph ₦ (U+20A6).
 * - Zero placeholder square glyphs (■).
 */

import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import * as fs from 'fs';
import { Invoice, Receipt } from '../types/invoice';
import { formatNaira } from '../lib/money';
import { BUSINESS_CONTACT, INVOICE_FOOTER } from '../policy/content';

const FONT_PATHS = [
  '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
  '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
];

const BOLD_FONT_PATHS = [
  '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
  '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
];

// Playbook Brand Kit Tokens
const COLOR_WINE = rgb(107 / 255, 18 / 255, 48 / 255);    // #6B1230
const COLOR_PURPLE = rgb(91 / 255, 42 / 255, 110 / 255);  // #5B2A6E
const COLOR_GOLD = rgb(212 / 255, 175 / 255, 55 / 255);   // #D4AF37
const COLOR_CREAM = rgb(247 / 255, 239 / 255, 217 / 255); // #F7EFD9
const COLOR_INK = rgb(11 / 255, 10 / 255, 9 / 255);       // #0B0A09
const COLOR_MUTED = rgb(90 / 255, 80 / 255, 75 / 255);

async function loadFonts(doc: PDFDocument) {
  doc.registerFontkit(fontkit);
  let fontRegular = null;
  let fontBold = null;

  for (const fp of FONT_PATHS) {
    if (fs.existsSync(fp)) {
      fontRegular = await doc.embedFont(fs.readFileSync(fp));
      break;
    }
  }

  for (const fp of BOLD_FONT_PATHS) {
    if (fs.existsSync(fp)) {
      fontBold = await doc.embedFont(fs.readFileSync(fp));
      break;
    }
  }

  return { fontRegular: fontRegular || fontBold!, fontBold: fontBold || fontRegular! };
}

/**
 * Generates an official branded Invoice PDF.
 */
export async function generateOfficialInvoicePdf(invoice: Invoice): Promise<{ pdfBytes: Uint8Array; filename: string }> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]); // A4
  const { width, height } = page.getSize();

  // Cream document background
  page.drawRectangle({
    x: 0,
    y: 0,
    width,
    height,
    color: COLOR_CREAM,
  });

  const { fontRegular, fontBold } = await loadFonts(doc);

  // Header Band: Wine (#6B1230)
  page.drawRectangle({
    x: 0,
    y: height - 100,
    width,
    height: 100,
    color: COLOR_WINE,
  });

  // Gold hairline rule under header
  page.drawRectangle({
    x: 0,
    y: height - 102,
    width,
    height: 2,
    color: COLOR_GOLD,
  });

  // Header text
  page.drawText('ROCK UC FOODS', {
    x: 40,
    y: height - 45,
    size: 22,
    font: fontBold,
    color: COLOR_CREAM,
  });

  page.drawText('Taste the Luxury | Authentic Nigerian Cuisine', {
    x: 40,
    y: height - 65,
    size: 9,
    font: fontRegular,
    color: COLOR_GOLD,
  });

  page.drawText(`${BUSINESS_CONTACT.collectionAddress} | Tel: ${BUSINESS_CONTACT.phone}`, {
    x: 40,
    y: height - 82,
    size: 8,
    font: fontRegular,
    color: COLOR_CREAM,
  });

  // Document Badge (Right aligned)
  page.drawText('INVOICE', {
    x: width - 160,
    y: height - 45,
    size: 18,
    font: fontBold,
    color: COLOR_GOLD,
  });

  page.drawText(`No: ${invoice.invoiceNumber}`, {
    x: width - 160,
    y: height - 65,
    size: 9,
    font: fontBold,
    color: COLOR_CREAM,
  });

  page.drawText(`Rev: ${invoice.revisionNumber} | Due: ${invoice.dueDate}`, {
    x: width - 160,
    y: height - 82,
    size: 8,
    font: fontRegular,
    color: COLOR_CREAM,
  });

  // Client Details Section
  let curY = height - 130;
  page.drawText('BILLED TO:', { x: 40, y: curY, size: 9, font: fontBold, color: COLOR_MUTED });
  curY -= 16;
  page.drawText(invoice.clientName, { x: 40, y: curY, size: 12, font: fontBold, color: COLOR_INK });
  curY -= 14;
  page.drawText(`Phone: ${invoice.clientPhone} ${invoice.clientEmail ? `| Email: ${invoice.clientEmail}` : ''}`, {
    x: 40,
    y: curY,
    size: 9,
    font: fontRegular,
    color: COLOR_MUTED,
  });

  // Table Header
  curY -= 25;
  page.drawRectangle({ x: 40, y: curY - 5, width: width - 80, height: 22, color: rgb(235 / 255, 225 / 255, 205 / 255) });
  page.drawText('ITEM DESCRIPTION', { x: 50, y: curY + 2, size: 9, font: fontBold, color: COLOR_INK });
  page.drawText('QTY', { x: 340, y: curY + 2, size: 9, font: fontBold, color: COLOR_INK });
  page.drawText('UNIT PRICE', { x: 400, y: curY + 2, size: 9, font: fontBold, color: COLOR_INK });
  page.drawText('TOTAL', { x: 485, y: curY + 2, size: 9, font: fontBold, color: COLOR_INK });

  // Line items
  curY -= 22;
  for (const itm of invoice.items) {
    page.drawText(itm.nameSnapshot, { x: 50, y: curY, size: 9, font: fontBold, color: COLOR_INK });
    if (itm.portionLabel) {
      page.drawText(`(${itm.portionLabel})`, { x: 220, y: curY, size: 8, font: fontRegular, color: COLOR_MUTED });
    }
    page.drawText(String(itm.quantity), { x: 345, y: curY, size: 9, font: fontRegular, color: COLOR_INK });
    page.drawText(formatNaira(itm.unitPriceKobo), { x: 400, y: curY, size: 9, font: fontRegular, color: COLOR_INK });
    page.drawText(formatNaira(itm.lineTotalKobo), { x: 485, y: curY, size: 9, font: fontBold, color: COLOR_INK });
    curY -= 18;
  }

  // Summary Totals
  curY -= 10;
  page.drawRectangle({ x: 40, y: curY + 12, width: width - 80, height: 1, color: COLOR_GOLD });
  
  const rightColX = 380;
  const valColX = 485;

  page.drawText('Subtotal:', { x: rightColX, y: curY, size: 9, font: fontRegular, color: COLOR_MUTED });
  page.drawText(formatNaira(invoice.subtotalKobo), { x: valColX, y: curY, size: 9, font: fontRegular, color: COLOR_INK });
  curY -= 16;

  if (invoice.deliveryFeeKobo > 0n) {
    page.drawText('Delivery / Logistics:', { x: rightColX, y: curY, size: 9, font: fontRegular, color: COLOR_MUTED });
    page.drawText(formatNaira(invoice.deliveryFeeKobo), { x: valColX, y: curY, size: 9, font: fontRegular, color: COLOR_INK });
    curY -= 16;
  }

  if (invoice.discountKobo > 0n) {
    page.drawText('Discount:', { x: rightColX, y: curY, size: 9, font: fontRegular, color: rgb(179 / 255, 38 / 255, 30 / 255) });
    page.drawText(`-${formatNaira(invoice.discountKobo)}`, { x: valColX, y: curY, size: 9, font: fontRegular, color: rgb(179 / 255, 38 / 255, 30 / 255) });
    curY -= 16;
  }

  // Total
  page.drawRectangle({ x: 360, y: curY - 5, width: width - 400, height: 24, color: COLOR_WINE });
  page.drawText('TOTAL INVOICE:', { x: 370, y: curY + 2, size: 10, font: fontBold, color: COLOR_CREAM });
  page.drawText(formatNaira(invoice.totalKobo), { x: valColX, y: curY + 2, size: 10, font: fontBold, color: COLOR_GOLD });
  curY -= 30;

  // Deposit & Balance Schedule
  page.drawText(`70% Deposit Required: ${formatNaira(invoice.depositKobo)} | 30% Balance on Delivery: ${formatNaira(invoice.balanceKobo)}`, {
    x: 40,
    y: curY,
    size: 9,
    font: fontBold,
    color: COLOR_INK,
  });
  curY -= 20;

  // Bank Details / Payment Instructions
  page.drawText('PAYMENT INSTRUCTIONS:', { x: 40, y: curY, size: 9, font: fontBold, color: COLOR_MUTED });
  curY -= 14;
  if (invoice.bankDetails && invoice.bankDetails.verifiedByOwner) {
    page.drawText(
      `Bank: ${invoice.bankDetails.bankName} | Account: ${invoice.bankDetails.accountNumber} | Name: ${invoice.bankDetails.accountName}`,
      { x: 40, y: curY, size: 9, font: fontRegular, color: COLOR_INK }
    );
  } else {
    page.drawText('Payment details will be sent by ROCK UC FOODS upon date verification.', {
      x: 40,
      y: curY,
      size: 9,
      font: fontRegular,
      color: COLOR_MUTED,
    });
  }

  // Footer terms
  page.drawText(INVOICE_FOOTER, {
    x: 40,
    y: 35,
    size: 7,
    font: fontRegular,
    color: COLOR_MUTED,
  });

  const pdfBytes = await doc.save();
  return {
    pdfBytes,
    filename: `${invoice.invoiceNumber}.pdf`,
  };
}

/**
 * Generates an official branded Receipt PDF.
 * Header band = Purple (#5B2A6E).
 */
export async function generateOfficialReceiptPdf(
  receipt: Receipt,
  invoice: Invoice
): Promise<{ pdfBytes: Uint8Array; filename: string }> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]); // A4
  const { width, height } = page.getSize();

  // Cream document background
  page.drawRectangle({
    x: 0,
    y: 0,
    width,
    height,
    color: COLOR_CREAM,
  });

  const { fontRegular, fontBold } = await loadFonts(doc);

  // Header Band: Purple (#5B2A6E)
  page.drawRectangle({
    x: 0,
    y: height - 100,
    width,
    height: 100,
    color: COLOR_PURPLE,
  });

  // Gold hairline rule
  page.drawRectangle({
    x: 0,
    y: height - 102,
    width,
    height: 2,
    color: COLOR_GOLD,
  });

  // Header text
  page.drawText('ROCK UC FOODS', {
    x: 40,
    y: height - 45,
    size: 22,
    font: fontBold,
    color: COLOR_CREAM,
  });

  page.drawText('Taste the Luxury | Authentic Nigerian Cuisine', {
    x: 40,
    y: height - 65,
    size: 9,
    font: fontRegular,
    color: COLOR_GOLD,
  });

  page.drawText(`${BUSINESS_CONTACT.collectionAddress} | Tel: ${BUSINESS_CONTACT.phone}`, {
    x: 40,
    y: height - 82,
    size: 8,
    font: fontRegular,
    color: COLOR_CREAM,
  });

  // Document Badge (Right aligned)
  page.drawText('RECEIPT', {
    x: width - 160,
    y: height - 45,
    size: 18,
    font: fontBold,
    color: COLOR_GOLD,
  });

  page.drawText(`No: ${receipt.receiptNumber}`, {
    x: width - 160,
    y: height - 65,
    size: 9,
    font: fontBold,
    color: COLOR_CREAM,
  });

  page.drawText(`Date: ${receipt.paymentDate}`, {
    x: width - 160,
    y: height - 82,
    size: 8,
    font: fontRegular,
    color: COLOR_CREAM,
  });

  // Receipt Content
  let curY = height - 140;
  page.drawText('PAYMENT CONFIRMATION:', { x: 40, y: curY, size: 10, font: fontBold, color: COLOR_MUTED });
  curY -= 20;

  page.drawText(`Customer: ${invoice.clientName}`, { x: 40, y: curY, size: 11, font: fontBold, color: COLOR_INK });
  curY -= 16;
  page.drawText(`Invoice Reference: ${invoice.invoiceNumber}`, { x: 40, y: curY, size: 9, font: fontRegular, color: COLOR_MUTED });
  curY -= 16;
  page.drawText(`Payment Method: ${receipt.paymentMethod.replace('_', ' ').toUpperCase()} | Payment Ref: ${receipt.paymentId}`, {
    x: 40,
    y: curY,
    size: 9,
    font: fontRegular,
    color: COLOR_MUTED,
  });

  curY -= 30;
  // Financial Summary Box
  page.drawRectangle({
    x: 40,
    y: curY - 70,
    width: width - 80,
    height: 90,
    color: rgb(238 / 255, 230 / 255, 212 / 255),
    borderColor: COLOR_GOLD,
    borderWidth: 1,
  });

  page.drawText('AMOUNT RECEIVED:', { x: 60, y: curY, size: 12, font: fontBold, color: COLOR_PURPLE });
  page.drawText(formatNaira(receipt.amountReceivedKobo), { x: 260, y: curY, size: 14, font: fontBold, color: COLOR_INK });
  curY -= 20;

  page.drawText('Total Invoice Amount:', { x: 60, y: curY, size: 9, font: fontRegular, color: COLOR_MUTED });
  page.drawText(formatNaira(receipt.invoiceTotalKobo), { x: 260, y: curY, size: 9, font: fontRegular, color: COLOR_INK });
  curY -= 16;

  page.drawText('Total Paid to Date:', { x: 60, y: curY, size: 9, font: fontRegular, color: COLOR_MUTED });
  page.drawText(formatNaira(receipt.paidToDateKobo), { x: 260, y: curY, size: 9, font: fontRegular, color: COLOR_INK });
  curY -= 16;

  page.drawText('Remaining Balance:', { x: 60, y: curY, size: 10, font: fontBold, color: COLOR_INK });
  page.drawText(formatNaira(receipt.balanceKobo), { x: 260, y: curY, size: 10, font: fontBold, color: receipt.balanceKobo === 0n ? rgb(0, 100 / 255, 0) : COLOR_WINE });

  // Status Badge
  curY -= 40;
  const isPaidInFull = receipt.receiptStatus === 'PAID IN FULL';
  page.drawRectangle({
    x: 40,
    y: curY - 5,
    width: 140,
    height: 24,
    color: isPaidInFull ? rgb(20 / 255, 80 / 255, 30 / 255) : COLOR_PURPLE,
  });
  page.drawText(receipt.receiptStatus, {
    x: 52,
    y: curY + 2,
    size: 10,
    font: fontBold,
    color: COLOR_CREAM,
  });

  // Timeframe confirmation indicator
  curY -= 30;
  if (receipt.timeframeStatus === 'Timeframe to be confirmed') {
    page.drawText('FULFILMENT STATUS: Timeframe to be confirmed by kitchen logistics.', {
      x: 40,
      y: curY,
      size: 9,
      font: fontBold,
      color: rgb(179 / 255, 38 / 255, 30 / 255),
    });
  } else {
    page.drawText('FULFILMENT STATUS: Delivery timeframe confirmed.', {
      x: 40,
      y: curY,
      size: 9,
      font: fontBold,
      color: rgb(20 / 255, 80 / 255, 30 / 255),
    });
  }

  // Footer notes
  page.drawText('Official payment receipt issued by ROCK UC FOODS. Verified by accounting ledger.', {
    x: 40,
    y: 35,
    size: 7,
    font: fontRegular,
    color: COLOR_MUTED,
  });

  const pdfBytes = await doc.save();
  return {
    pdfBytes,
    filename: `${receipt.receiptNumber}.pdf`,
  };
}
