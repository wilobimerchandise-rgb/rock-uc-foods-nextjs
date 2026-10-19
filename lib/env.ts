/**
 * ROCK UC FOODS - Environment Configuration & Validation Module
 * Playbook v2 Section 3, 10 & 16.C
 * 
 * Enforces strict separation of client vs server secrets.
 * Server keys (SUPABASE_SERVICE_ROLE_KEY, PAYSTACK_SECRET_KEY, CRON_SECRET)
 * must NEVER be exposed with NEXT_PUBLIC_ prefixes.
 */

export interface EnvAuditResult {
  variable: string;
  isSet: boolean;
  length: number;
  prefix: string;
  isServerOnly: boolean;
  isValidPrefix: boolean;
}

/**
 * Validates and retrieves the configured document link TTL in hours.
 * Must read from DOCUMENT_LINK_TTL_HOUR (or DOCUMENT_LINK_TTL_HOURS) env, never hardcoded.
 */
export function getDocumentLinkTtlHours(): number {
  const envVal = process.env.DOCUMENT_LINK_TTL_HOUR || process.env.DOCUMENT_LINK_TTL_HOURS;
  if (envVal) {
    const parsed = parseInt(envVal, 10);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return 72; // Standard Playbook fallback
}

/**
 * Returns environment variables configuration safely.
 */
export const env = {
  // Public Client Safe
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
  paystackPublicKey: process.env.PAYSTACK_PUBLIC_KEY || '',
  featurePaystackEnabled: process.env.FEATURE_PAYSTACK_ENABLED === 'true',
  featureManualPaymentsEnabled: process.env.FEATURE_MANUAL_PAYMENTS_ENABLED === 'true',

  // Server Only
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  paystackSecretKey: process.env.PAYSTACK_SECRET_KEY || '',
  cronSecret: process.env.CRON_SECRET || '',
  orderAlertEmails: (process.env.ORDER_ALERT_EMAILS || 'rock-uc-foods@gmail.com,estherkwentua@gmail.com').split(','),
  emailProviderApiKey: process.env.EMAIL_PROVIDER_API_KEY || '',
  documentLinkTtlHours: getDocumentLinkTtlHours(),
};

/**
 * Audits all required environment variables checking presence, length, and required prefixes
 * WITHOUT logging or printing any secret contents.
 */
export function auditEnvironmentVariables(): EnvAuditResult[] {
  const tracked = [
    { key: 'GEMINI_API_KEY', serverOnly: true, expectedPrefix: null },
    { key: 'APP_URL', serverOnly: true, expectedPrefix: 'http' },
    { key: 'NEXT_PUBLIC_SITE_URL', serverOnly: false, expectedPrefix: 'http' },
    { key: 'NEXT_PUBLIC_SUPABASE_URL', serverOnly: false, expectedPrefix: 'http' },
    { key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', serverOnly: false, expectedPrefix: 'eyJ' },
    { key: 'SUPABASE_SERVICE_ROLE_KEY', serverOnly: true, expectedPrefix: 'eyJ' },
    { key: 'PAYSTACK_PUBLIC_KEY', serverOnly: false, expectedPrefix: 'pk_' },
    { key: 'PAYSTACK_SECRET_KEY', serverOnly: true, expectedPrefix: 'sk_' },
    { key: 'CRON_SECRET', serverOnly: true, expectedPrefix: null },
    { key: 'DOCUMENT_LINK_TTL_HOUR', serverOnly: true, expectedPrefix: null },
    { key: 'DOCUMENT_LINK_TTL_HOURS', serverOnly: true, expectedPrefix: null },
  ];

  return tracked.map(({ key, serverOnly, expectedPrefix }) => {
    const val = process.env[key];
    const isSet = Boolean(val && val.length > 0);
    const length = val ? val.length : 0;
    const prefix = val ? val.slice(0, 4) : '';
    const isValidPrefix = expectedPrefix ? (val ? val.startsWith(expectedPrefix) : false) : true;

    return {
      variable: key,
      isSet,
      length,
      prefix,
      isServerOnly: serverOnly,
      isValidPrefix,
    };
  });
}
