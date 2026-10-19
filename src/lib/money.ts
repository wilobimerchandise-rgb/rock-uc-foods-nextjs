/**
 * ROCK UC FOODS - Core Money Module
 * Strictly BigInt integer kobo arithmetic.
 * NEVER use float, double, or numeric for monetary operations.
 * Display strictly with the Naira sign U+20A6 (₦). Never 'NGN'.
 */

export const MAX_KOBO = 100_000_000_000n; // ₦1,000,000,000.00 (One Billion Naira)
export const NAIRA_SYMBOL = '\u20A6'; // ₦

/**
 * Formats a BigInt kobo amount into an official Naira string.
 * Example: 123456789n -> "₦1,234,567.89"
 * Example: 350000n -> "₦3,500.00"
 */
export function formatNaira(kobo: bigint): string {
  const isNegative = kobo < 0n;
  const absKobo = isNegative ? -kobo : kobo;

  const wholeNaira = absKobo / 100n;
  const fractionalKobo = absKobo % 100n;

  // Format whole Naira with thousands separators using string/integer logic
  const wholeStr = wholeNaira.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const fracStr = fractionalKobo.toString().padStart(2, '0');

  const signPrefix = isNegative ? '-' : '';
  return `${signPrefix}${NAIRA_SYMBOL}${wholeStr}.${fracStr}`;
}

/**
 * Parses user-typed currency input into BigInt integer kobo using strict integer arithmetic.
 * Rejects negatives, more than 2 decimal digits, non-numeric strings, and values > MAX_KOBO.
 *
 * Example: "1,500.5" -> 150050n
 * Example: "3500.00" -> 350000n
 * Example: "0.5" -> 50n
 */
export function parseNairaToKobo(input: string): bigint {
  if (typeof input !== 'string') {
    throw new Error('Invalid input: price must be a string.');
  }

  // Trim whitespace and remove optional leading ₦ symbol or comma separators
  let cleaned = input.trim();
  if (cleaned.startsWith(NAIRA_SYMBOL)) {
    cleaned = cleaned.slice(NAIRA_SYMBOL.length).trim();
  }

  if (cleaned === '') {
    throw new Error('Invalid input: price cannot be empty.');
  }

  // Reject negative inputs explicitly
  if (cleaned.startsWith('-')) {
    throw new Error('Invalid input: negative amounts are not permitted.');
  }

  // Remove valid thousands separators
  const sanitized = cleaned.replace(/,/g, '');

  // Must match integer or decimal with up to 2 decimal places: e.g. "123", "123.4", "123.45"
  const regex = /^\d+(\.\d{1,2})?$/;
  if (!regex.test(sanitized)) {
    if (/^\d+\.\d{3,}$/.test(sanitized)) {
      throw new Error('Invalid input: maximum 2 decimal places allowed.');
    }
    throw new Error('Invalid input: must be a valid numeric amount.');
  }

  const parts = sanitized.split('.');
  const wholePart = BigInt(parts[0]);

  let koboPart = 0n;
  if (parts.length > 1) {
    const fracStr = parts[1].padEnd(2, '0');
    koboPart = BigInt(fracStr);
  }

  const totalKobo = wholePart * 100n + koboPart;

  if (totalKobo > MAX_KOBO) {
    throw new Error(`Invalid input: amount exceeds maximum allowed (${formatNaira(MAX_KOBO)}).`);
  }

  return totalKobo;
}

/**
 * Calculates a percentage of kobo using basis points (bps) with half-up integer rounding.
 * 1% = 100 bps; 7.5% = 750 bps; 70% = 7000 bps; 100% = 10000 bps.
 *
 * Formula: round_half_up(kobo * bps / 10000) = (kobo * bps + 5000) / 10000
 *
 * Example: applyPercentRoundHalfUp(333n, 750) -> 25n (7.5% of 333 = 24.975 -> 25)
 */
export function applyPercentRoundHalfUp(kobo: bigint, bps: number): bigint {
  if (kobo < 0n) {
    throw new Error('Calculation error: negative kobo amount not supported.');
  }
  if (!Number.isInteger(bps) || bps < 0) {
    throw new Error('Calculation error: basis points must be a non-negative integer.');
  }

  if (kobo === 0n || bps === 0) {
    return 0n;
  }

  const bpsBig = BigInt(bps);
  return (kobo * bpsBig + 5000n) / 10000n;
}

/**
 * Computes the 70% upfront deposit and 30% balance on delivery.
 * Deposit is rounded half-up once; balance is total minus deposit.
 */
export function calculate7030Split(totalKobo: bigint): { depositKobo: bigint; balanceKobo: bigint } {
  if (totalKobo < 0n) {
    throw new Error('Total kobo cannot be negative.');
  }
  const depositKobo = applyPercentRoundHalfUp(totalKobo, 7000); // 70.00%
  const balanceKobo = totalKobo - depositKobo;
  return { depositKobo, balanceKobo };
}
