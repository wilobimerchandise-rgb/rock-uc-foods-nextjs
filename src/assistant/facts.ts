/**
 * ROCK UC FOODS - Assistant Facts Builder
 * Playbook v4 Section 19.2
 * 
 * Compiles the strictly allowed facts for the LLM to ground on.
 * Returns allowedKobo and allowedPercents for deterministic verifyReply checks.
 */

import { MenuFact } from './types';
import { formatKobo } from '../lib/money';
import {
  BUSINESS_CONTACT,
  ALLERGEN_NOTICE,
  INVOICE_FOOTER,
  PAYMENT_VERIFICATION_FRAUD_RULE,
  REFUND_REQUEST_INSTRUCTIONS,
} from '../policy/content';

export interface AssistantFacts {
  factsText: string;
  allowedKobo: Set<bigint>;
  allowedPercents: Set<number>;
}

export function buildFacts(menu: MenuFact[]): AssistantFacts {
  const allowedKobo = new Set<bigint>();
  const allowedPercents = new Set<number>([70, 30, 80, 50, 25, 100, 20]);

  // Format at most 300 menu lines
  const slicedMenu = menu.slice(0, 300);
  const menuLines: string[] = [];

  for (const item of slicedMenu) {
    allowedKobo.add(item.priceKobo);
    const portionStr = item.portion ? ` (${item.portion})` : '';
    menuLines.push(
      `- [${item.category}] ${item.name}${portionStr}: ${formatKobo(item.priceKobo)}`
    );
  }

  const businessFacts = [
    `Orders require a minimum of 24 hours advance notice.`,
    `Payment is accepted via manual bank transfer only to the verified company account.`,
    `70% deposit is required upfront; the remaining 30% balance is payable on delivery.`,
    `Unpaid orders automatically expire after 7 hours.`,
    `Cooking starts only after the upfront deposit is verified in our bank statement.`,
    `Business location: ${BUSINESS_CONTACT.location}. Phone/WhatsApp: ${BUSINESS_CONTACT.phone}. Instagram: ${BUSINESS_CONTACT.instagram}.`,
  ];

  const unknownList = [
    `Exact delivery areas and zone fees (must send customer to WhatsApp ${BUSINESS_CONTACT.phone}).`,
    `Specific pickup/collection address (must send customer to WhatsApp ${BUSINESS_CONTACT.phone}).`,
    `How the 30% balance is settled on delivery (transfer vs cash) (must send customer to WhatsApp).`,
    `Weekly operating days and opening hours (must send customer to WhatsApp).`,
    `Recipe ingredients, nutritional facts, or halal certification (must send customer to WhatsApp).`,
    `High-res dish photos, PDF menu brochures, or unlisted custom dishes (must send customer to WhatsApp).`,
  ];

  const factsText = `
=== BUSINESS FACTS (EXACT TRUTH) ===
${businessFacts.join('\n')}

=== LIVE MENU (UP TO 300 ITEMS) ===
${menuLines.length > 0 ? menuLines.join('\n') : 'Menu currently loading.'}

=== TOPICS OUTSIDE SCOPE (DIRECT TO WHATSAPP ${BUSINESS_CONTACT.phone}) ===
${unknownList.join('\n')}

=== OFFICIAL POLICIES ===
Allergen: ${ALLERGEN_NOTICE}
Invoice Policy: ${INVOICE_FOOTER}
Payment Policy: ${PAYMENT_VERIFICATION_FRAUD_RULE}
Refund Instructions: ${REFUND_REQUEST_INSTRUCTIONS}
`.trim();

  return {
    factsText,
    allowedKobo,
    allowedPercents,
  };
}
