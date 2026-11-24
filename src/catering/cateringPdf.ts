/**
 * ROCK UC FOODS - Official Catering Invoice & Quote PDF Generator
 * (Playbook v2 Section 10 & Section 17 v3 Addendum)
 * Generates high-fidelity PDF documents with authentic brand styling,
 * itemized catering breakdowns, deposit/balance schedules, and verbatim policy footers.
 */

import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { CateringEvent, CateringQuote } from '../types/catering';
import { BUSINESS_CONTACT, INVOICE_FOOTER, ALLERGEN_NOTICE } from '../policy/content';
import { formatNaira } from '../lib/money';
import { getBusinessBankSettings, hasVerifiedBankSettings } from '../lib/businessSettings';

async function loadFontBytesFromServer(relPublicName: string, systemFallbackPaths: string[]): Promise<Uint8Array | null> {
  try {
    const [nodeFs, nodePath] = await Promise.all([
      import(/* webpackIgnore: true */ 'node:fs'),
      import(/* webpackIgnore: true */ 'node:path'),
    ]);
    const localPublicPath = nodePath.join(process.cwd(), 'public', 'fonts', relPublicName);
    for (const fp of [localPublicPath, ...systemFallbackPaths]) {
      if (nodeFs.existsSync(fp)) {
        return new Uint8Array(nodeFs.readFileSync(fp));
      }
    }
  } catch {
    return null;
  }
  return null;
}

async function loadFontBytesFromBrowser(relPublicName: string): Promise<Uint8Array | null> {
  try {
    const res = await fetch(`/fonts/${relPublicName}`);
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    return new Uint8Array(buf);
  } catch {
    return null;
  }
}

async function loadCateringFonts(pdfDoc: PDFDocument) {
  pdfDoc.registerFontkit(fontkit);
  const isBrowser = typeof window !== 'undefined';

  const loadBytes = async (relPublicName: string, sysPaths: string[]) =>
    isBrowser
      ? loadFontBytesFromBrowser(relPublicName)
      : loadFontBytesFromServer(relPublicName, sysPaths);

  const [regularBytes, boldBytes, italicBytes] = await Promise.all([
    loadBytes('LiberationSans-Regular.ttf', [
      '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
      '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
    ]),
    loadBytes('LiberationSans-Bold.ttf', [
      '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
      '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
    ]),
    loadBytes('LiberationSans-Italic.ttf', [
      '/usr/share/fonts/truetype/liberation/LiberationSans-Italic.ttf',
      '/usr/share/fonts/truetype/dejavu/DejaVuSans-Oblique.ttf',
    ]),
  ]);

  if (!regularBytes) {
    throw new Error('Required PDF TrueType font (LiberationSans-Regular.ttf) could not be loaded.');
  }

  const regular = await pdfDoc.embedFont(regularBytes);
  const bold = boldBytes ? await pdfDoc.embedFont(boldBytes) : regular;
  const oblique = italicBytes ? await pdfDoc.embedFont(italicBytes) : regular;

  return { font: regular, fontBold: bold, fontOblique: oblique };
}

export interface CateringPdfResult {
  pdfBytes: Uint8Array;
  filename: string;
}

export interface CateringPdfOptions {
  bankDetails?: {
    bankName: string;
    accountName: string;
    accountNumber: string;
  } | null;
}

export async function generateCateringInvoicePdf(
  event: CateringEvent,
  quote: CateringQuote,
  options?: CateringPdfOptions
): Promise<CateringPdfResult> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4 (595 x 842 points)
  const { width, height } = page.getSize();

  const { font, fontBold, fontOblique } = await loadCateringFonts(pdfDoc);

  // Palette
  const colorWine = rgb(107 / 255, 18 / 255, 48 / 255); // #6B1230
  const colorGold = rgb(212 / 255, 175 / 255, 55 / 255); // #D4AF37
  const colorDark = rgb(23 / 255, 18 / 255, 15 / 255);
  const colorCream = rgb(247 / 255, 239 / 255, 217 / 255);
  const colorGray = rgb(100 / 255, 100 / 255, 100 / 255);
  const colorLightBg = rgb(248 / 255, 246 / 255, 240 / 255);

  // 1. Top Header Banner (Wine)
  page.drawRectangle({
    x: 0,
    y: height - 90,
    width,
    height: 90,
    color: colorWine,
  });

  // Header Title & Tagline
  page.drawText(BUSINESS_CONTACT.name, {
    x: 40,
    y: height - 42,
    size: 20,
    font: fontBold,
    color: colorCream,
  });

  page.drawText(BUSINESS_CONTACT.tagline.toUpperCase(), {
    x: 40,
    y: height - 58,
    size: 9,
    font: fontBold,
    color: colorGold,
  });

  page.drawText(`${BUSINESS_CONTACT.collectionAddress} | Tel: ${BUSINESS_CONTACT.phone}`, {
    x: 40,
    y: height - 74,
    size: 8,
    font,
    color: colorCream,
  });

  // Document Badge (Right aligned)
  page.drawText('CATERING QUOTE & INVOICE', {
    x: width - 230,
    y: height - 42,
    size: 11,
    font: fontBold,
    color: colorGold,
  });

  page.drawText(`Ref: ${event.eventCode}`, {
    x: width - 230,
    y: height - 58,
    size: 9,
    font: fontBold,
    color: colorCream,
  });

  page.drawText(`Revision: ${quote.revisionNumber} | Date: ${new Date(quote.createdAt).toLocaleDateString()}`, {
    x: width - 230,
    y: height - 74,
    size: 8,
    font,
    color: colorCream,
  });

  let curY = height - 120;

  // 2. Client & Event Details Box
  page.drawRectangle({
    x: 40,
    y: curY - 75,
    width: width - 80,
    height: 85,
    color: colorLightBg,
    borderColor: rgb(220 / 255, 215 / 255, 200 / 255),
    borderWidth: 1,
  });

  // Left Column: Client Info
  page.drawText('CLIENT DETAILS', { x: 55, y: curY - 12, size: 8, font: fontBold, color: colorWine });
  page.drawText(event.clientName, { x: 55, y: curY - 26, size: 10, font: fontBold, color: colorDark });
  page.drawText(`Phone: ${event.clientPhone}`, { x: 55, y: curY - 40, size: 9, font, color: colorDark });
  if (event.clientEmail) {
    page.drawText(`Email: ${event.clientEmail}`, { x: 55, y: curY - 54, size: 9, font, color: colorDark });
  }

  // Right Column: Event Info
  const colX2 = 320;
  page.drawText('EVENT SPECIFICATIONS', { x: colX2, y: curY - 12, size: 8, font: fontBold, color: colorWine });
  page.drawText(`${event.eventType} (${event.guestCount} Guests)`, { x: colX2, y: curY - 26, size: 10, font: fontBold, color: colorDark });
  page.drawText(`Event Date: ${event.eventDate}`, { x: colX2, y: curY - 40, size: 9, font, color: colorDark });
  page.drawText(`Venue: ${event.venueAddress.slice(0, 42)}`, { x: colX2, y: curY - 54, size: 8, font, color: colorDark });
  page.drawText(`Live Cooking: ${event.liveCookingRequested ? 'YES (Station included)' : 'Buffet Dropoff'}`, {
    x: colX2,
    y: curY - 68,
    size: 8,
    font: fontBold,
    color: colorDark,
  });

  curY -= 105;

  // 3. Line Items Table Header
  page.drawRectangle({
    x: 40,
    y: curY - 18,
    width: width - 80,
    height: 22,
    color: colorDark,
  });

  page.drawText('ITEM / CATERING PACKAGE', { x: 50, y: curY - 11, size: 8, font: fontBold, color: colorGold });
  page.drawText('QTY', { x: 315, y: curY - 11, size: 8, font: fontBold, color: colorGold });
  page.drawText('UNIT PRICE', { x: 365, y: curY - 11, size: 8, font: fontBold, color: colorGold });
  page.drawText('LINE TOTAL', { x: 465, y: curY - 11, size: 8, font: fontBold, color: colorGold });

  curY -= 28;

  // 4. Line Items Rows
  for (const item of quote.items) {
    page.drawText(item.name.slice(0, 42), { x: 50, y: curY, size: 9, font: fontBold, color: colorDark });
    if (item.portionLabel) {
      page.drawText(item.portionLabel, { x: 50, y: curY - 11, size: 8, font: fontOblique, color: colorGray });
    }

    page.drawText(String(item.quantity), { x: 320, y: curY, size: 9, font, color: colorDark });
    page.drawText(formatNaira(item.unitPriceKobo), { x: 365, y: curY, size: 9, font, color: colorDark });
    page.drawText(formatNaira(item.totalKobo), { x: 465, y: curY, size: 9, font: fontBold, color: colorDark });

    curY -= 24;
  }

  // Divider
  page.drawLine({
    start: { x: 40, y: curY + 6 },
    end: { x: width - 40, y: curY + 6 },
    color: rgb(220 / 255, 215 / 255, 200 / 255),
    thickness: 1,
  });

  curY -= 15;

  // 5. Financial Summary Block (Right aligned)
  const sumLabelX = 335;
  const sumValX = 465;

  page.drawText('Food Subtotal:', { x: sumLabelX, y: curY, size: 8, font, color: colorDark });
  page.drawText(formatNaira(quote.foodSubtotalKobo), { x: sumValX, y: curY, size: 8, font, color: colorDark });
  curY -= 14;

  page.drawText('Logistics & Transport:', { x: sumLabelX, y: curY, size: 8, font, color: colorDark });
  page.drawText(formatNaira(quote.logisticsFeeKobo), { x: sumValX, y: curY, size: 8, font, color: colorDark });
  curY -= 14;

  page.drawText('Service & Equipment Crew:', { x: sumLabelX, y: curY, size: 8, font, color: colorDark });
  page.drawText(formatNaira(quote.serviceFeeKobo), { x: sumValX, y: curY, size: 8, font, color: colorDark });
  curY -= 18;

  // Grand Total Box
  page.drawRectangle({
    x: sumLabelX - 10,
    y: curY - 8,
    width: width - sumLabelX - 30,
    height: 22,
    color: colorWine,
  });

  page.drawText('GRAND TOTAL:', { x: sumLabelX, y: curY - 1, size: 9, font: fontBold, color: colorCream });
  page.drawText(formatNaira(quote.totalKobo), { x: sumValX, y: curY - 1, size: 10, font: fontBold, color: colorGold });

  curY -= 40;

  // 6. Payment Schedule (Deposit + Balance)
  page.drawRectangle({
    x: 40,
    y: curY - 55,
    width: width - 80,
    height: 65,
    color: colorLightBg,
    borderColor: colorGold,
    borderWidth: 1,
  });

  page.drawText('PAYMENT SCHEDULE & COMMITMENT', { x: 55, y: curY - 12, size: 8, font: fontBold, color: colorWine });

  page.drawText(
    `Deposit Required (${quote.depositPercentage}% to secure date): ${formatNaira(quote.depositKobo)} [Status: ${quote.depositStatus.toUpperCase()}]`,
    {
      x: 55,
      y: curY - 28,
      size: 9,
      font: fontBold,
      color: quote.depositStatus === 'paid' ? rgb(16 / 255, 120 / 255, 60 / 255) : colorWine,
    }
  );

  page.drawText(
    `Balance Due (30% payable 48h before event): ${formatNaira(quote.balanceKobo)} [Status: ${quote.balanceStatus.toUpperCase()}]`,
    { x: 55, y: curY - 42, size: 9, font, color: colorDark }
  );

  curY -= 75;

  // 7. Official Bank Transfer Account Details
  page.drawRectangle({
    x: 40,
    y: curY - 45,
    width: width - 80,
    height: 52,
    color: rgb(245 / 255, 240 / 255, 230 / 255),
    borderColor: rgb(200 / 255, 190 / 255, 170 / 255),
    borderWidth: 1,
  });

  const bankSettings =
    options && 'bankDetails' in options
      ? options.bankDetails
        ? { ...options.bankDetails, verifiedByOwner: true }
        : null
      : getBusinessBankSettings();
  const bankReady = Boolean(bankSettings && hasVerifiedBankSettings(bankSettings));

  page.drawText('OFFICIAL BANK PAYMENT DETAILS', { x: 55, y: curY - 10, size: 8, font: fontBold, color: colorDark });
  page.drawText(
    bankReady && bankSettings
      ? `Bank: ${bankSettings.bankName}   |   Account No: ${bankSettings.accountNumber}   |   Account Name: ${bankSettings.accountName}`
      : 'Payment details will be sent by ROCK UC FOODS.',
    {
      x: 55,
      y: curY - 24,
      size: 8,
      font: fontBold,
      color: colorWine,
    }
  );
  page.drawText(`Payment Reference: ${event.eventCode}   (Please send bank transfer confirmation via WhatsApp 08033729125)`, {
    x: 55,
    y: curY - 37,
    size: 8,
    font,
    color: colorDark,
  });

  curY -= 65;

  // 8. Mandatory Policy Footer (Verbatim from Section 17.7 & 17 v3)
  page.drawText('MANDATORY REFUND & CANCELLATION POLICY (VERBATIM):', {
    x: 40,
    y: curY,
    size: 7,
    font: fontBold,
    color: colorWine,
  });

  curY -= 12;
  page.drawText(INVOICE_FOOTER, {
    x: 40,
    y: curY,
    size: 7,
    font,
    color: colorGray,
    maxWidth: width - 80,
    lineHeight: 9,
  });

  curY -= 28;
  page.drawText(`Allergen Advisory: ${ALLERGEN_NOTICE}`, {
    x: 40,
    y: curY,
    size: 6.5,
    font: fontOblique,
    color: colorGray,
    maxWidth: width - 80,
    lineHeight: 8.5,
  });

  const pdfBytes = await pdfDoc.save();
  const filename = `ROCK_UC_FOODS_Invoice_${event.eventCode}_Rev${quote.revisionNumber}.pdf`;

  return {
    pdfBytes,
    filename,
  };
}
