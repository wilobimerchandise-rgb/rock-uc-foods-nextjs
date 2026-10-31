/**
 * ROCK UC FOODS - Nigerian Phone Number Normalizer & Telco Validator
 * Playbook v4 Section 25
 */

export interface PhoneNormalizationResult {
  valid: boolean;
  e164: string;
  national: string;
  telco?: 'MTN' | 'Airtel' | 'Glo' | '9mobile' | 'Other';
  reason?: string;
}

const TELCO_PREFIXES: Record<string, 'MTN' | 'Airtel' | 'Glo' | '9mobile'> = {
  // MTN
  '0803': 'MTN',
  '0806': 'MTN',
  '0703': 'MTN',
  '0706': 'MTN',
  '0813': 'MTN',
  '0816': 'MTN',
  '0810': 'MTN',
  '0814': 'MTN',
  '0903': 'MTN',
  '0906': 'MTN',
  '0913': 'MTN',
  '0916': 'MTN',

  // Airtel
  '0802': 'Airtel',
  '0808': 'Airtel',
  '0708': 'Airtel',
  '0812': 'Airtel',
  '0701': 'Airtel',
  '0902': 'Airtel',
  '0901': 'Airtel',
  '0904': 'Airtel',
  '0907': 'Airtel',
  '0912': 'Airtel',

  // Glo
  '0805': 'Glo',
  '0807': 'Glo',
  '0705': 'Glo',
  '0815': 'Glo',
  '0811': 'Glo',
  '0905': 'Glo',
  '0915': 'Glo',

  // 9mobile
  '0809': '9mobile',
  '0817': '9mobile',
  '0818': '9mobile',
  '0909': '9mobile',
  '0908': '9mobile',
};

/**
 * Normalizes any Nigerian telephone input into strict E.164 (+234...) and National (080...) formats.
 */
export function normalizeNigerianPhone(rawPhone: string): PhoneNormalizationResult {
  if (!rawPhone || typeof rawPhone !== 'string') {
    return { valid: false, e164: '', national: '', reason: 'Phone number is empty or undefined.' };
  }

  // Strip all non-numeric characters except leading +
  const trimmed = rawPhone.trim();
  const digitsOnly = trimmed.replace(/\D/g, '');

  let baseDigits = '';

  if (trimmed.startsWith('+234')) {
    baseDigits = digitsOnly.slice(3); // Remove 234
  } else if (digitsOnly.startsWith('234') && digitsOnly.length === 13) {
    baseDigits = digitsOnly.slice(3); // Remove 234
  } else if (digitsOnly.startsWith('0') && digitsOnly.length === 11) {
    baseDigits = digitsOnly.slice(1); // Remove leading 0
  } else if (digitsOnly.length === 10) {
    baseDigits = digitsOnly;
  } else {
    return {
      valid: false,
      e164: '',
      national: '',
      reason: `Invalid Nigerian phone format: expected 11 digits (e.g. 08031234567), received ${digitsOnly.length} digits.`,
    };
  }

  // Full 10 digits check
  if (baseDigits.length !== 10) {
    return {
      valid: false,
      e164: '',
      national: '',
      reason: 'Invalid phone length.',
    };
  }

  const national = `0${baseDigits}`;
  const e164 = `+234${baseDigits}`;

  // Identify telco prefix
  const prefix = national.slice(0, 4);
  const telco = TELCO_PREFIXES[prefix] || 'Other';

  return {
    valid: true,
    e164,
    national,
    telco,
  };
}
