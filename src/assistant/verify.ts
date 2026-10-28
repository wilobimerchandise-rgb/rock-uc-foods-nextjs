/**
 * ROCK UC FOODS - Assistant Reply Verifier
 * Playbook v4 Section 19.2
 * 
 * Rejects hallucinations, foreign prices, invented percentages, foreign numbers/links,
 * and unauthorized commitments.
 */

import { AssistantFacts } from './facts';
import { parseNairaToKobo } from '../lib/money';
import { BUSINESS_CONTACT } from '../policy/content';

export interface VerifyResult {
  valid: boolean;
  reason?: string;
}

export function verifyReply(
  reply: string | null | undefined,
  facts: AssistantFacts,
  allowedSiteHost: string = 'rockucfoods.com'
): VerifyResult {
  if (!reply || reply.trim().length === 0) {
    return { valid: false, reason: 'empty_reply' };
  }

  const trimmed = reply.trim();

  // 1. Over 900 characters
  if (trimmed.length > 900) {
    return { valid: false, reason: 'reply_too_long' };
  }

  // 2. Contains the word 'NGN' (case insensitive)
  if (/\bNGN\b/i.test(trimmed)) {
    return { valid: false, reason: 'contains_ngn' };
  }

  // 3. Unauthorized commitments
  const commitmentPattern =
    /\b(your payment has been confirmed|payment is confirmed|i have marked your order|i will refund|refund approved|your refund has been granted|order has been confirmed)\b/i;
  if (commitmentPattern.test(trimmed)) {
    return { valid: false, reason: 'unauthorized_commitment' };
  }

  // 4. Any phone number other than the business phone
  const phoneMatches = trimmed.match(/\+?\d{10,14}/g);
  if (phoneMatches) {
    for (const phone of phoneMatches) {
      const normalizedPhone = phone.replace(/[^\d]/g, '');
      const businessNormalized = BUSINESS_CONTACT.phoneInternational.replace(/[^\d]/g, '');
      const localNormalized = '0' + businessNormalized.slice(3); // '08033729125'

      if (normalizedPhone !== businessNormalized && normalizedPhone !== localNormalized) {
        return { valid: false, reason: `foreign_phone_number: ${phone}` };
      }
    }
  }

  // 5. Any URL whose host is not the site host or whatsapp
  const urlMatches = trimmed.match(/https?:\/\/[^\s/$.?#].[^\s]*/gi);
  if (urlMatches) {
    for (const urlStr of urlMatches) {
      try {
        const parsed = new URL(urlStr);
        const host = parsed.hostname.toLowerCase();
        if (
          host !== allowedSiteHost &&
          host !== `www.${allowedSiteHost}` &&
          host !== 'wa.me' &&
          host !== 'api.whatsapp.com'
        ) {
          return { valid: false, reason: `foreign_url_host: ${host}` };
        }
      } catch {
        return { valid: false, reason: 'malformed_url' };
      }
    }
  }

  // 6. Percentages check: any % in text must be in allowedPercents
  const percentMatches = trimmed.match(/(\d+(?:\.\d+)?)%/g);
  if (percentMatches) {
    for (const p of percentMatches) {
      const val = parseFloat(p.replace('%', ''));
      if (!facts.allowedPercents.has(val)) {
        return { valid: false, reason: `unauthorized_percentage: ${p}` };
      }
    }
  }

  // 7. Naira amounts check: (₦1,500, N1500, 3500 naira, 4.5k)
  // Extract patterns that represent currency
  const nairaRegex = /(?:₦|N|\b)(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)\s*(?:naira|\b)/gi;
  let match;
  while ((match = nairaRegex.exec(trimmed)) !== null) {
    const candidate = match[1];
    // Filter out common years or small integers like 24 hours, 7 hours, 2 hours
    const prevContext = trimmed.slice(Math.max(0, match.index - 10), match.index).toLowerCase();
    const nextContext = trimmed.slice(match.index + match[0].length, match.index + match[0].length + 10).toLowerCase();

    if (
      nextContext.includes('hour') ||
      nextContext.includes('hr') ||
      nextContext.includes('day') ||
      nextContext.includes('min') ||
      prevContext.includes('within') ||
      prevContext.includes('under') ||
      prevContext.includes('after')
    ) {
      continue;
    }

    try {
      const parsedKobo = parseNairaToKobo(candidate);
      // If it looks like a price (> ₦500), it MUST be in the menu
      if (parsedKobo >= 50000n && !facts.allowedKobo.has(parsedKobo)) {
        return { valid: false, reason: `unauthorized_price: ₦${candidate}` };
      }
    } catch {
      // not a parseable kobo amount
    }
  }

  return { valid: true };
}
