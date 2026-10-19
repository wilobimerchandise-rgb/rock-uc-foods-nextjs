/**
 * ROCK UC FOODS - Single Source of Truth for Policy Wording
 * (Playbook v2 Section 17 v3 Addendum)
 * Imported by checkout, refund policy page, invoice footer, and PDF documents.
 */

export const POLICY_VERSION = '2026-10-15-v3';

export const BUSINESS_CONTACT = {
  name: 'ROCK UC FOODS',
  tagline: 'Taste the Luxury',
  subtitle: 'Authentic Nigerian Cuisine Redefined',
  phone: '08033729125',
  phoneInternational: '+2348033729125',
  whatsappUrl: 'https://wa.me/2348033729125',
  instagram: '@rock-uc-foods',
  collectionAddress: '5 Aro street, Lagos',
  location: 'Lagos, Nigeria',
  timezone: 'Africa/Lagos',
  emailAlertRecipients: ['rock-uc-foods@gmail.com', 'estherkwentua@gmail.com'],
} as const;

/**
 * Allergen Notice (Verbatim - shown on menu, checkout, and invoices)
 */
export const ALLERGEN_NOTICE =
  'If you have any severe allergy, please contact us on WhatsApp 08033729125 before ordering. We will advise if we can prepare your meal safely. We cannot guarantee a completely allergen-free environment.';

/**
 * Checkout Consent Checkbox (Verbatim - placed directly above PAY button)
 */
export const CHECKOUT_POLICY_CHECKBOX_LABEL =
  'I agree to the Refund & Cancellation Policy: Fresh meals cannot be cancelled after cooking starts. Bulk orders: Less than 24 hours no refund. Delivery fees non-refundable. Quality issues must be reported within 2 hours with photo.';

/**
 * Payment Verification & Fraud Prevention Rule (FCCPA compliance)
 */
export const PAYMENT_VERIFICATION_FRAUD_RULE =
  'Per our policy, refunds are only processed for verified payments. Fake alerts/screenshots not verified in our bank statement will not be refunded or cooked. This protects you and us.';

export const FCCPA_RIGHTS_STATEMENT =
  'Your Rights: Nothing in this policy removes your rights under the Federal Competition and Consumer Protection Act (FCCPA), enforced by the FCCPC. For unresolved disputes, contact us first. We aim to resolve within 48 hours. ROCK UC FOODS | Lagos, Nigeria | Tel: 08033729125.';

/**
 * Refund Request Steps
 */
export const REFUND_REQUEST_INSTRUCTIONS =
  'WhatsApp 08033729125. Subject: REFUND - Order RUC-XXXX. Include Order ID, reason, photo if quality issue. We acknowledge within 4 hours (9am-8pm). Bank transfer: refund in 24-48 hours.';

/**
 * Invoice Footer (Verbatim - printed on every invoice)
 */
export const INVOICE_FOOTER =
  'Cancellation: Fresh orders non-cancellable after cooking. Bulk Orders: 72h+ 80% refund, 48-72h 50%, 24-48h 25%, Less than 24h no refund. Refunds: 48h (bank transfer). Issues: report within 2h with photo via 08033729125. Full policy at rockucfoods.com/refund-policy';

/**
 * Full Refund & Cancellation Policy Details
 */
export const REFUND_POLICY_DETAILS = {
  title: 'ROCK UC FOODS - REFUND & CANCELLATION POLICY',
  generalRules:
    'No returns after collection or delivery. Delivery fee is non-refundable unless failure is ours. Refunds go to original verified payment method only. Report quality issues within 2-hour window with photo evidence.',
  freshOrders: [
    {
      condition: 'Within 30 mins AND before cooking started',
      consequence: '100% refund of food + delivery fee',
    },
    {
      condition: 'After cooking started or > 30 mins',
      consequence: 'Non-refundable. You may send someone to collect.',
    },
    {
      condition: 'Wrong address / phone off / refused delivery',
      consequence: 'Non-refundable. Marked delivered after 2 calls + 15 min wait.',
    },
    {
      condition: 'We cancel / out of stock',
      consequence: '100% refund including delivery fee',
    },
  ],
  bulkOrders: [
    { notice: '72 hours or more', refundPercentage: '80% refund of food subtotal' },
    { notice: '48-72 hours', refundPercentage: '50% refund of food subtotal' },
    { notice: '24-48 hours', refundPercentage: '25% refund of food subtotal' },
    { notice: 'Less than 24 hours / same day', refundPercentage: 'Non-refundable' },
  ],
  qualityIssues:
    'Must report within 2-hour window with Order ID + photo evidence. Keep 50% of food. Valid: spoilage, foreign object, wrong order from us = replace same day OR 50-100% refund/credit. Not valid: taste preference, late due to wrong address or flood beyond control = non-refundable.',
  deliveryFailureByUs:
    'If driver exceeds confirmed window by 90 mins with no contact: 100% refund including delivery fee OR accept late with 20% credit.',
} as const;
