/**
 * ROCK UC FOODS - Official Catering Invoice & Quote PDF Generator
 * (Playbook v2 Section 10 & Section 17 v3 Addendum)
 * Generates high-fidelity PDF documents with authentic brand styling,
 * itemized catering breakdowns, deposit/balance schedules, and verbatim policy footers.
 */

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { CateringEvent, CateringQuote } from '../types/catering';
import { BUSINESS_CONTACT, INVOICE_FOOTER, ALLERGEN_NOTICE } from '../policy/content';

export interface CateringPdfResult {
  pdfBytes: Uint8Array;
  filename: string;
}

/**
 * Standard PDF font-safe currency formatter (NGN X,XXX.XX)
 * Prevents WinAnsi encoding errors with Helvetica while retaining exact kobo accuracy.
 */
function formatPdfMoney(kobo: bigint): string {
  const naira = Number(kobo) / 100;
  return `NGN ${naira.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export async function generateCateringInvoicePdf(
  event: CateringEvent,
  quote: CateringQuote
): Promise<CateringPdfResult> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4 (595 x 842 points)
  const { width, height } = page.getSize();

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

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
  page.drawText('QTY', { x: 330, y: curY - 11, size: 8, font: fontBold, color: colorGold });
  page.drawText('UNIT PRICE (NGN)', { x: 380, y: curY - 11, size: 8, font: fontBold, color: colorGold });
  page.drawText('LINE TOTAL (NGN)', { x: 480, y: curY - 11, size: 8, font: fontBold, color: colorGold });

  curY -= 28;

  // 4. Line Items Rows
  for (const item of quote.items) {
    page.drawText(item.name.slice(0, 42), { x: 50, y: curY, size: 9, font: fontBold, color: colorDark });
    if (item.portionLabel) {
      page.drawText(item.portionLabel, { x: 50, y: curY - 11, size: 8, font: fontOblique, color: colorGray });
    }

    page.drawText(String(item.quantity), { x: 335, y: curY, size: 9, font, color: colorDark });
    page.drawText(formatPdfMoney(item.unitPriceKobo), { x: 380, y: curY, size: 9, font, color: colorDark });
    page.drawText(formatPdfMoney(item.totalKobo), { x: 480, y: curY, size: 9, font: fontBold, color: colorDark });

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
  const sumLabelX = 350;
  const sumValX = 480;

  page.drawText('Food Subtotal:', { x: sumLabelX, y: curY, size: 8, font, color: colorDark });
  page.drawText(formatPdfMoney(quote.foodSubtotalKobo), { x: sumValX, y: curY, size: 8, font, color: colorDark });
  curY -= 14;

  page.drawText('Logistics & Transport:', { x: sumLabelX, y: curY, size: 8, font, color: colorDark });
  page.drawText(formatPdfMoney(quote.logisticsFeeKobo), { x: sumValX, y: curY, size: 8, font, color: colorDark });
  curY -= 14;

  page.drawText('Service & Equipment Crew:', { x: sumLabelX, y: curY, size: 8, font, color: colorDark });
  page.drawText(formatPdfMoney(quote.serviceFeeKobo), { x: sumValX, y: curY, size: 8, font, color: colorDark });
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
  page.drawText(formatPdfMoney(quote.totalKobo), { x: sumValX, y: curY - 1, size: 10, font: fontBold, color: colorGold });

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
    `Deposit Required (${quote.depositPercentage}% to secure date): ${formatPdfMoney(quote.depositKobo)} [Status: ${quote.depositStatus.toUpperCase()}]`,
    {
      x: 55,
      y: curY - 28,
      size: 9,
      font: fontBold,
      color: quote.depositStatus === 'paid' ? rgb(16 / 255, 120 / 255, 60 / 255) : colorWine,
    }
  );

  page.drawText(
    `Balance Due (30% payable 48h before event): ${formatPdfMoney(quote.balanceKobo)} [Status: ${quote.balanceStatus.toUpperCase()}]`,
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

  page.drawText('OFFICIAL BANK PAYMENT DETAILS', { x: 55, y: curY - 10, size: 8, font: fontBold, color: colorDark });
  page.drawText('Bank: Wema Bank   |   Account No: 0258778644   |   Account Name: ROCK UC FOODS / ESTHER KWENTUA', {
    x: 55,
    y: curY - 24,
    size: 8,
    font: fontBold,
    color: colorWine,
  });
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
