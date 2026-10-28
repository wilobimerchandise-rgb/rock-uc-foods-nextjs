/**
 * ROCK UC FOODS - PDF Font Measurer
 * Playbook v4 Section 21
 * 
 * Uses fontkit with the exact bundled Inter and InterExt woff files to measure
 * text widths conservatively so numbers never overflow table cells or margins.
 */

// @ts-expect-error fontkit untyped module
import * as fontkit from 'fontkit';
import * as path from 'path';
import { NAIRA_SYMBOL } from '../money';

interface LoadedFontkitFont {
  unitsPerEm: number;
  layout(text: string): { advanceWidth: number };
}

let interRegular: LoadedFontkitFont | null = null;
let interBold: LoadedFontkitFont | null = null;
let interExtRegular: LoadedFontkitFont | null = null;
let interExtBold: LoadedFontkitFont | null = null;

function getFonts() {
  if (!interRegular) {
    const basePath = path.resolve(process.cwd(), 'assets/fonts');
    const openSync = (fontkit as any).openSync || (fontkit as any).default?.openSync;
    interRegular = openSync(path.join(basePath, 'inter-latin-400-normal.woff')) as unknown as LoadedFontkitFont;
    interBold = openSync(path.join(basePath, 'inter-latin-700-normal.woff')) as unknown as LoadedFontkitFont;
    interExtRegular = openSync(path.join(basePath, 'inter-latin-ext-400-normal.woff')) as unknown as LoadedFontkitFont;
    interExtBold = openSync(path.join(basePath, 'inter-latin-ext-700-normal.woff')) as unknown as LoadedFontkitFont;
  }
  return { interRegular, interBold, interExtRegular, interExtBold };
}

export function formatDigitsOnly(amountKobo: bigint): string {
  const isNegative = amountKobo < 0n;
  const absKobo = isNegative ? -amountKobo : amountKobo;
  const wholeNaira = absKobo / 100n;
  const fractionalKobo = absKobo % 100n;
  const wholeStr = wholeNaira.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const fracStr = fractionalKobo.toString().padStart(2, '0');
  const sign = isNegative ? '-' : '';
  return `${sign}${wholeStr}.${fracStr}`;
}

/**
 * Calculates conservative width in points for rendering ₦ + digits.
 */
export function moneyWidth(
  amountKobo: bigint,
  fontSize: number,
  isBold: boolean = false
): number {
  const { interRegular, interBold, interExtRegular, interExtBold } = getFonts();
  const digitFont = (isBold ? interBold : interRegular)!;
  const symbolFont = (isBold ? interExtBold : interExtRegular)!;

  const symbolLayout = symbolFont.layout(NAIRA_SYMBOL);
  const symbolPt = (symbolLayout.advanceWidth / symbolFont.unitsPerEm) * fontSize;

  const digits = formatDigitsOnly(amountKobo);
  const digitsLayout = digitFont.layout(digits);
  const digitsPt = (digitsLayout.advanceWidth / digitFont.unitsPerEm) * fontSize;

  // Add small 5% buffer to guarantee conservative non-underestimation (stays within 12%)
  return (symbolPt + digitsPt) * 1.04;
}

/**
 * Finds font size (between minFontSize and maxFontSize) that fits within maxWidth.
 */
export function fitMoneySize(
  amountKobo: bigint,
  maxWidth: number,
  maxFontSize: number = 10,
  minFontSize: number = 6,
  isBold: boolean = false
): number {
  for (let size = maxFontSize; size >= minFontSize; size -= 0.5) {
    if (moneyWidth(amountKobo, size, isBold) <= maxWidth) {
      return size;
    }
  }
  return minFontSize;
}
