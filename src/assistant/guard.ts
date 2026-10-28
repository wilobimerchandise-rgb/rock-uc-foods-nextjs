/**
 * ROCK UC FOODS - AI Customer Assistant Guard
 * Playbook v4 Section 19.2
 * 
 * Strict deterministic filter running BEFORE any model call.
 * First matching rule wins.
 */

import { AssistantReply } from './types';
import {
  ALLERGEN_NOTICE,
  PAYMENT_VERIFICATION_FRAUD_RULE,
  REFUND_REQUEST_INSTRUCTIONS,
  BUSINESS_CONTACT,
} from '../policy/content';

export const MAX_MESSAGE_CHARS = 500;

// Cyrillic and Greek look-alike letter mapping to Latin
const LOOKALIKE_MAP: Record<string, string> = {
  // Cyrillic
  'а': 'a', 'б': 'b', 'в': 'b', 'г': 'r', 'д': 'd', 'е': 'e', 'ё': 'e',
  'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'i', 'к': 'k', 'л': 'l', 'м': 'm',
  'н': 'h', 'о': 'o', 'п': 'n', 'р': 'p', 'с': 'c', 'т': 't', 'у': 'y',
  'ф': 'f', 'х': 'x', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'shch', 'ъ': '',
  'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya', 'і': 'i', 'ї': 'i',
  // Greek
  'α': 'a', 'β': 'b', 'γ': 'g', 'δ': 'd', 'ε': 'e', 'ζ': 'z', 'η': 'h',
  'θ': 'th', 'ι': 'i', 'κ': 'k', 'λ': 'l', 'μ': 'm', 'ν': 'n', 'ξ': 'x',
  'ο': 'o', 'π': 'p', 'ρ': 'r', 'σ': 's', 'τ': 't', 'υ': 'u', 'φ': 'ph',
  'χ': 'ch', 'ψ': 'ps', 'ω': 'w',
};

export function normalizeMessage(raw: string): string {
  if (!raw) return '';

  // 1. NFKD normalization
  let s = raw.normalize('NFKD');

  // 2. Lowercase
  s = s.toLowerCase();

  // 3. Strip accents and diacritics
  s = s.replace(/[\u0300-\u036f]/g, '');

  // 4. Remove zero-width & control characters
  s = s.replace(/[\u200B-\u200D\uFEFF\x00-\x1F\x7F]/g, '');

  // 5. Fold look-alike Cyrillic & Greek letters to Latin
  let mapped = '';
  for (const ch of s) {
    mapped += LOOKALIKE_MAP[ch] ?? ch;
  }
  s = mapped;

  // 6. Collapse multiple spaces
  return s.replace(/\s+/g, ' ').trim();
}

/**
 * Checks squashed letters to catch tricks like 'i g n o r e' or 'b y p a s s'
 */
function lettersSquashed(text: string): string {
  return text.replace(/[^a-z0-9]/g, '');
}

export function guardMessage(raw: string): AssistantReply | null {
  if (!raw || raw.trim().length === 0) {
    return {
      kind: 'invalid',
      text: 'Please send a non-empty message.',
      reason: 'empty_message',
    };
  }

  if (raw.length > MAX_MESSAGE_CHARS) {
    return {
      kind: 'invalid',
      text: `Your message is too long (maximum ${MAX_MESSAGE_CHARS} characters). Please shorten it.`,
      reason: 'message_too_long',
    };
  }

  const norm = normalizeMessage(raw);
  const squashed = lettersSquashed(norm);

  // 1. INJECTION (refused)
  const injectionSquashedKeywords = [
    'ignorepreviousinstructions',
    'disregardallinstructions',
    'ignoreallrules',
    'overridemyinstructions',
    'bypassallpolicies',
    'developermode',
    'jailbreak',
  ];
  const hasSquashedInjection = injectionSquashedKeywords.some((k) => squashed.includes(k));

  const nearInstructionPattern =
    /\b(ignore|disregard|forget|override|bypass)\b.{0,40}\b(instruction|rule|prompt|policy|guideline|restriction)/i;
  const promptSeekingPattern =
    /\b(system prompt|hidden prompt|reveal your rules|what are your instructions|print prompt|repeat your instructions)\b/i;
  const jailbreakRolePattern =
    /\b(developer mode|jailbreak|you are now|pretend to be|act as an unrestricted|dan mode)\b/i;

  if (
    hasSquashedInjection ||
    nearInstructionPattern.test(norm) ||
    promptSeekingPattern.test(norm) ||
    jailbreakRolePattern.test(norm)
  ) {
    return {
      kind: 'refused',
      text: 'I am the automated assistant for ROCK UC FOODS. I cannot ignore or alter my operating instructions.',
      reason: 'injection',
    };
  }

  // 2. OTHER CUSTOMER DATA (refused)
  const customerDataPattern =
    /\b(last customer|other customer|another customer|someone else's order|look up phone|check order for|customer address|customer phone)\b|order for 080|check order for 080|look up 080/i;
  if (customerDataPattern.test(norm)) {
    return {
      kind: 'refused',
      text: 'For privacy reasons, we cannot share other customer details or look up orders by phone number. Please use your private order tracking link or WhatsApp us with your Order Reference.',
      whatsappUrl: BUSINESS_CONTACT.whatsappUrl,
      reason: 'other_customer_data',
    };
  }

  // 3. ACTION REQUEST (refused)
  // mark/set/update/confirm/verify/approve near paid, payment, order status or refund
  const actionNearPaymentPattern =
    /\b(mark|set|update|confirm|verify|approve)\b.{0,30}\b(paid|payment|order status|refund)\b/i;
  if (actionNearPaymentPattern.test(norm)) {
    return {
      kind: 'refused',
      text: PAYMENT_VERIFICATION_FRAUD_RULE,
      whatsappUrl: BUSINESS_CONTACT.whatsappUrl,
      reason: 'action_request',
    };
  }

  // 4. DISCOUNT OR AUTHORITY (refused)
  const discountPattern =
    /\b(discount|% off|percent off|half price|free food|free delivery|reduce the price|lower the price|negotiate|manager said|owner said|esther said)\b/i;
  if (discountPattern.test(norm)) {
    return {
      kind: 'refused',
      text: 'Our menu prices and delivery fees are fixed and computed directly on our system. We cannot offer unauthorized discounts or price alterations.',
      whatsappUrl: BUSINESS_CONTACT.whatsappUrl,
      reason: 'discount_or_authority',
    };
  }

  // 5. IDENTITY (policy)
  const identityPattern =
    /\b(who are you|are you a human|are you an ai|are you a robot|are you real|who made you)\b/i;
  if (identityPattern.test(norm)) {
    return {
      kind: 'policy',
      text: `I am an AI assistant for ROCK UC FOODS, not a human. ROCK UC FOODS is a premier Nigerian catering brand based in Lagos. Follow us on Instagram ${BUSINESS_CONTACT.instagram} or message Chef Esther on WhatsApp ${BUSINESS_CONTACT.phone}.`,
      whatsappUrl: BUSINESS_CONTACT.whatsappUrl,
      reason: 'identity',
    };
  }

  // 6. ALLERGEN (handoff) - Egg & Soy are NOT triggers
  const allergenTriggers = [
    'allerg', 'anaphyl', 'intoleran', 'celiac',
    'nut', 'groundnut', 'peanut', 'shellfish', 'crayfish', 'prawn',
    'gluten', 'lactose', 'dairy', 'sesame',
  ];
  const hasAllergen = allergenTriggers.some((trig) => norm.includes(trig));
  if (hasAllergen) {
    return {
      kind: 'handoff',
      text: ALLERGEN_NOTICE,
      whatsappUrl: BUSINESS_CONTACT.whatsappUrl,
      reason: 'allergen',
    };
  }

  // 7. COMPLAINT (handoff)
  const complaintPattern =
    /\b(complaint|spoil|foreign object|spoiled|smelly|hair in food|bad food|disgusted|terrible meal|wrong food received)\b/i;
  if (complaintPattern.test(norm)) {
    return {
      kind: 'handoff',
      text: `We sincerely apologise for any inconvenience. Please message us on WhatsApp ${BUSINESS_CONTACT.phone} with your Order ID and photo evidence within 2 hours of receipt so our team can resolve it immediately.`,
      whatsappUrl: BUSINESS_CONTACT.whatsappUrl,
      reason: 'complaint',
    };
  }

  // 8. REFUND DEMAND (policy)
  const refundDemandPattern =
    /\b(refund me|money back|i want a refund|how do i request a refund|claim refund)\b/i;
  if (refundDemandPattern.test(norm)) {
    return {
      kind: 'policy',
      text: `${REFUND_REQUEST_INSTRUCTIONS}\n\n${PAYMENT_VERIFICATION_FRAUD_RULE}`,
      whatsappUrl: BUSINESS_CONTACT.whatsappUrl,
      reason: 'refund_demand',
    };
  }

  // 9. EVENT QUOTE (handoff)
  // 21 or more guests/people/packs/plates/portions OR wedding, burial, funeral, conference, corporate, catering, live cooking, tasting, quote
  // Skipped when message mentions refund, cancel, reduce, guest count or change
  const isExcludedFromEventHandoff =
    /\b(refund|cancel|reduce|guest count|change)\b/i.test(norm);

  if (!isExcludedFromEventHandoff) {
    const bulkEventKeywords =
      /\b(wedding|burial|funeral|conference|corporate|catering|live cooking|tasting|quote)\b/i;
    const guestCountMatch = norm.match(/\b(\d+)\s*(guests?|people|packs?|plates?|portions?)\b/i);

    let isOver20Guests = false;
    if (guestCountMatch) {
      const count = parseInt(guestCountMatch[1], 10);
      if (count >= 21) {
        isOver20Guests = true;
      }
    }

    if (isOver20Guests || bulkEventKeywords.test(norm)) {
      return {
        kind: 'handoff',
        text: `For catering events and orders of 21+ packs, please submit our Event Planning Inquiry or chat with Chef Esther directly on WhatsApp at ${BUSINESS_CONTACT.phone} for bespoke menus and quotes.`,
        whatsappUrl: BUSINESS_CONTACT.whatsappUrl,
        reason: 'event_quote',
      };
    }
  }

  return null;
}
