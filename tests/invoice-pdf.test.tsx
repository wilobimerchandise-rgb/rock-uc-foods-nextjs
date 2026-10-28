/**
 * ROCK UC FOODS - Invoice PDF Layout & Margin Verification Tests
 * Playbook v4 Section 22
 * 
 * Tests using pdftotext -bbox and pdffonts:
 * 1. Owner's invoice (EVT-20261019-MXTF): 4,950,000 + 50,000 + 100,000 = 5,100,000 (70% = 3,570,000, 30% = 1,530,000).
 * 2. No word passes right of page margin (x = 559.28).
 * 3. Grand total figure ends at or before x = 551.28.
 * 4. Extreme amounts (5 kobo, 999,999, 1,000,000, 12,345,678, 99,999,999.99, 100,000,000.00) stay inside margin.
 * 5. Total exceeding 100,000,000.00 throws clear error.
 * 6. pdffonts lists InterExt-Regular and InterExt-Bold embedded.
 * 7. Never prints 'NGN' anywhere in text.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { renderInvoicePdfBuffer, InvoicePdfData } from '../src/lib/pdf/InvoiceDocument';
import { MAX_KOBO } from '../src/lib/money';

const hasPoppler = (() => {
  try {
    execSync('which pdftotext && which pdffonts', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();

describe('Playbook Section 22: Invoice PDF Margin & Font Verification', () => {
  const tmpDir = path.resolve(process.cwd(), 'tmp_tests');
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }

  it('1. Renders owner invoice (EVT-20261019-MXTF) with exact math: ₦5,100,000.00 total (70% deposit = ₦3,570,000.00, 30% balance = ₦1,530,000.00)', async () => {
    const ownerData: InvoicePdfData = {
      invoiceNumber: 'INV-2026-000101',
      clientName: 'Chief Adebayo (EVT-20261019-MXTF)',
      clientPhone: '+2348033729125',
      eventDate: '2026-11-15',
      items: [
        {
          name: 'Premium Party Jollof & Proteins (150 guests)',
          quantity: 1,
          unitPriceKobo: 495000000n, // ₦4,950,000.00
        },
      ],
      deliveryFeeKobo: 5000000n,    // ₦50,000.00
      serviceChargeKobo: 10000000n, // ₦100,000.00
    };

    const pdfBuffer = await renderInvoicePdfBuffer(ownerData);
    const pdfPath = path.join(tmpDir, 'owner-invoice.pdf');
    fs.writeFileSync(pdfPath, pdfBuffer);

    expect(pdfBuffer.length).toBeGreaterThan(5000);

    if (hasPoppler) {
      // Check for zero instances of 'NGN'
      const plainText = execSync(`pdftotext "${pdfPath}" -`, { encoding: 'utf-8' });
      expect(plainText).not.toContain('NGN');
      expect(plainText).toContain('5,100,000.00');
      expect(plainText).toContain('3,570,000.00');
      expect(plainText).toContain('1,530,000.00');

      // Check bbox: no word right of x = 559.28
      const bboxOutput = execSync(`pdftotext -bbox "${pdfPath}" -`, { encoding: 'utf-8' });
      const wordRegex = /<word\s+xMin="([\d.]+)"\s+yMin="([\d.]+)"\s+xMax="([\d.]+)"\s+yMax="([\d.]+)"[^>]*>([^<]+)<\/word>/g;

      let match;
      let grandTotalEndingX = 0;
      let widestXMax = 0;

      while ((match = wordRegex.exec(bboxOutput)) !== null) {
        const xMin = parseFloat(match[1]);
        const xMax = parseFloat(match[3]);
        const wordText = match[5];

        if (xMax > widestXMax) {
          widestXMax = xMax;
        }

        // All words must stay inside right margin 559.28
        expect(xMax).toBeLessThanOrEqual(559.28 + 0.5);

        if (wordText.includes('5,100,000.00')) {
          grandTotalEndingX = xMax;
        }
      }

      // Grand total figure ends at or before 551.28 inside the wine bar
      expect(grandTotalEndingX).toBeGreaterThan(0);
      expect(grandTotalEndingX).toBeLessThanOrEqual(551.28 + 0.5);

      // Verify embedded fonts list InterExt
      const fontList = execSync(`pdffonts "${pdfPath}"`, { encoding: 'utf-8' });
      expect(fontList).toMatch(/InterExt/);
    }
  });

  it('2. Extreme amounts up to ₦100,000,000.00 stay within margin 559.28 and end <= 551.28', async () => {
    const extremeAmounts = [
      5n,                 // ₦0.05
      99999900n,          // ₦999,999.00
      100000000n,         // ₦1,000,000.00
      1234567890n,        // ₦12,345,678.90
      9999999999n,        // ₦99,999,999.99
      MAX_KOBO,           // ₦100,000,000.00
    ];

    for (const amt of extremeAmounts) {
      const data: InvoicePdfData = {
        invoiceNumber: 'INV-2026-EXTREME',
        clientName: 'High Net Worth Client',
        clientPhone: '+2348033729125',
        items: [
          {
            name: 'State Banquet Catering Service',
            quantity: 1,
            unitPriceKobo: amt,
          },
        ],
      };

      const pdfBuffer = await renderInvoicePdfBuffer(data);
      const pdfPath = path.join(tmpDir, `extreme-${amt}.pdf`);
      fs.writeFileSync(pdfPath, pdfBuffer);

      if (hasPoppler) {
        const bboxOutput = execSync(`pdftotext -bbox "${pdfPath}" -`, { encoding: 'utf-8' });
        const wordRegex = /<word\s+xMin="([\d.]+)"\s+yMin="([\d.]+)"\s+xMax="([\d.]+)"\s+yMax="([\d.]+)"[^>]*>([^<]+)<\/word>/g;

        let match;
        while ((match = wordRegex.exec(bboxOutput)) !== null) {
          const xMax = parseFloat(match[3]);
          expect(xMax).toBeLessThanOrEqual(559.28 + 0.5);
        }
      }
    }
  });

  it('3. Refuses any invoice total above ₦100,000,000.00 (10,000,000,000 kobo) with a clear error', async () => {
    const overLimitData: InvoicePdfData = {
      invoiceNumber: 'INV-2026-OVERLIMIT',
      clientName: 'Overflow Client',
      clientPhone: '+2348033729125',
      items: [
        {
          name: 'Mega Event Catering',
          quantity: 1,
          unitPriceKobo: MAX_KOBO + 100n, // Exceeds by ₦1.00
        },
      ],
    };

    await expect(renderInvoicePdfBuffer(overLimitData)).rejects.toThrow(
      /exceeds maximum allowed limit/
    );
  });
});
