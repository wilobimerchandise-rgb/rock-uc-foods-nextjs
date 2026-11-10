/**
 * ROCK UC FOODS - Production Security Logger & PII Sanitizer
 * Playbook v2 Section 13 (Phase 8 Item 4)
 * 
 * Rules:
 * 1. Zero customer phone numbers (E.164, 080..., 090..., 070..., 081...) in logs.
 * 2. Zero delivery addresses, customer street directions, or GPS data in logs.
 * 3. Zero payment payloads, account numbers, provider tokens, or webhook signatures in logs.
 * 4. Zero internal stack traces exposed in production.
 */

// Phone number regex matching +234 or Nigerian local mobile prefixes
const NIGERIAN_PHONE_REGEX = /(\+?234|0)[789][01]\d{8}/g;

// Email regex
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

// Credit card / account number regex (10 digits for NUBAN account or 16 digits for card)
const SENSITIVE_NUMBER_REGEX = /\b(?:\d{4}[-\s]?){3}\d{4}\b|\b\d{10}\b/g;

// Sensitive keys in object payloads
const SENSITIVE_KEYS = new Set([
  'phone',
  'customerphone',
  'riderphone',
  'recipientphone',
  'address',
  'deliveryaddress',
  'street',
  'token',
  'accesstoken',
  'trackingtoken',
  'sharetoken',
  'password',
  'secret',
  'signature',
  'payload',
  'authorization',
  'bankaccount',
  'accountnumber',
  'cardnumber',
  'cvv',
]);

/**
 * Scrubs a string of phones, emails, and sensitive payment numbers.
 */
export function sanitizeLogString(str: string): string {
  if (!str || typeof str !== 'string') return '';
  return str
    .replace(NIGERIAN_PHONE_REGEX, '[PHONE_REDACTED]')
    .replace(EMAIL_REGEX, '[EMAIL_REDACTED]')
    .replace(SENSITIVE_NUMBER_REGEX, '[ACCOUNT_REDACTED]');
}

/**
 * Deeply scrubs an object or array payload of sensitive PII and payment data.
 */
export function sanitizeLogData<T>(data: T): T {
  if (data === null || data === undefined) return data;

  if (typeof data === 'string') {
    return sanitizeLogString(data) as unknown as T;
  }

  if (typeof data === 'bigint') {
    return data.toString() as unknown as T;
  }

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeLogData(item)) as unknown as T;
  }

  if (typeof data === 'object') {
    const sanitizedObj: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      const lowerKey = key.toLowerCase().replace(/[^a-z]/g, '');

      if (SENSITIVE_KEYS.has(lowerKey)) {
        sanitizedObj[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        sanitizedObj[key] = sanitizeLogData(value);
      } else if (typeof value === 'string') {
        sanitizedObj[key] = sanitizeLogString(value);
      } else {
        sanitizedObj[key] = value;
      }
    }
    return sanitizedObj as T;
  }

  return data;
}

export interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  context?: Record<string, unknown>;
  error?: string;
}

export function logInfo(message: string, context?: Record<string, unknown>): LogEntry {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level: 'info',
    message: sanitizeLogString(message),
    context: context ? sanitizeLogData(context) : undefined,
  };
  console.log(JSON.stringify(entry));
  return entry;
}

export function logWarn(message: string, context?: Record<string, unknown>): LogEntry {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level: 'warn',
    message: sanitizeLogString(message),
    context: context ? sanitizeLogData(context) : undefined,
  };
  console.warn(JSON.stringify(entry));
  return entry;
}

export function logError(
  message: string,
  error?: unknown,
  context?: Record<string, unknown>
): LogEntry {
  const isProduction = process.env.NODE_ENV === 'production';
  let errorSummary = 'InternalError';

  if (error instanceof Error) {
    if (isProduction) {
      // In production, never leak file paths or line numbers
      errorSummary = error.message
        .replace(/\s*\([^)]*:[0-9]+:[0-9]+\)/g, '')
        .replace(/(?:\/[a-zA-Z0-9_.-]+)+/g, '[PATH]');
    } else {
      errorSummary = `${error.name}: ${error.message}`;
    }
  } else if (typeof error === 'string') {
    errorSummary = isProduction
      ? error.replace(/(?:\/[a-zA-Z0-9_.-]+)+/g, '[PATH]')
      : error;
  }

  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level: 'error',
    message: sanitizeLogString(message),
    error: sanitizeLogString(errorSummary),
    context: context ? sanitizeLogData(context) : undefined,
  };
  console.error(JSON.stringify(entry));
  return entry;
}
