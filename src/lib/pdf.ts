/**
 * ROCK UC FOODS - PDF Document Generation Module
 * Embeds brand tokens and ensures the Naira sign ₦ (U+20A6) is rendered cleanly in document text.
 */

import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import * as fs from 'fs';
import { formatNaira, NAIRA_SYMBOL } from './money';

export interface SamplePdfResult {
  pdfBytes: Uint8Array;
  textPayload: string;
}

// System font candidates supporting Unicode
const FONT_PATHS = [
  '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
  '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
];

/**
 * Creates a sample PDF containing receipt text with the ₦ symbol embedded.
 */
export async function generateSampleReceiptPdf(koboAmount: bigint = 150000n): Promise<SamplePdfResult> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  const page = pdfDoc.addPage([595.28, 841.89]); // A4 dimensions in points
  const { width, height } = page.getSize();

  const formattedPrice = formatNaira(koboAmount); // e.g. "₦1,500.00"

  // Draw luxury header bar (Wine #6B1230)
  page.drawRectangle({
    x: 0,
    y: height - 80,
    width,
    height: 80,
    color: rgb(107 / 255, 18 / 255, 48 / 255),
  });

  // Embed font if available
  let customFont = null;
  for (const fp of FONT_PATHS) {
    if (fs.existsSync(fp)) {
      const fontBytes = fs.readFileSync(fp);
      customFont = await pdfDoc.embedFont(fontBytes);
      break;
    }
  }

  const receiptLine = `ROCK UC FOODS RECEIPT - Total: ${formattedPrice}`;

  if (customFont) {
    page.drawText('ROCK UC FOODS', {
      x: 40,
      y: height - 50,
      size: 22,
      font: customFont,
      color: rgb(247 / 255, 239 / 255, 217 / 255), // Cream #F7EFD9
    });

    page.drawText(receiptLine, {
      x: 40,
      y: height - 140,
      size: 14,
      font: customFont,
      color: rgb(11 / 255, 10 / 255, 9 / 255), // Ink #0B0A09
    });
  }

  // Set PDF Metadata
  pdfDoc.setTitle(`ROCK UC FOODS Receipt - ${formattedPrice}`);
  pdfDoc.setAuthor('ROCK UC FOODS');
  pdfDoc.setSubject(`Official Payment Receipt: ${formattedPrice}`);

  const pdfBytes = await pdfDoc.save();

  return {
    pdfBytes,
    textPayload: receiptLine,
  };
}
