/**
 * ROCK UC FOODS - Dedicated Refund Policy Route & Policy Reconciliation Tests
 * Verifies /refund-policy SSR content, SEO route registration, Section 35 sizing/tokens,
 * and deterministic BigInt kobo refund invariants (empty/cap/duplicate/boundary cases).
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import RefundPolicyPage, { metadata } from '../app/refund-policy/page';
import {
  POLICY_VERSION,
  PAYMENT_VERIFICATION_FRAUD_RULE,
  FCCPA_RIGHTS_STATEMENT,
  REFUND_REQUEST_INSTRUCTIONS,
  REFUND_POLICY_DETAILS,
  INVOICE_FOOTER,
} from '../src/policy/content';
import { PUBLIC_ROUTES, isPublicPath, isPrivatePath } from '../src/seo/routes';
import sitemap from '../app/sitemap';
import { calculateRefund, bulkRefundBps, classifyOrder } from '../src/policy/refund';
import * as fs from 'fs';
import * as path from 'path';

describe('Refund Policy Route & Single Source of Truth', () => {
  it('renders /refund-policy with all required legal, fraud-prevention, fresh, bulk, quality, and FCCPA sections', () => {
    const rawHtml = renderToStaticMarkup(<RefundPolicyPage />);
    const html = rawHtml
      .replace(/&amp;/g, '&')
      .replace(/&gt;/g, '>')
      .replace(/&lt;/g, '<')
      .replace(/&#x27;/g, "'");

    expect(metadata.title).toContain('Refund & Cancellation Policy');
    expect(html).toContain(POLICY_VERSION);
    expect(html).toContain(REFUND_POLICY_DETAILS.title);
    expect(html).toContain(PAYMENT_VERIFICATION_FRAUD_RULE);
    expect(html).toContain(FCCPA_RIGHTS_STATEMENT);
    expect(html).toContain(REFUND_REQUEST_INSTRUCTIONS);
    expect(html).toContain(REFUND_POLICY_DETAILS.qualityIssues);
    expect(html).toContain(REFUND_POLICY_DETAILS.deliveryFailureByUs);
    expect(html).toContain(INVOICE_FOOTER);

    for (const rule of REFUND_POLICY_DETAILS.freshOrders) {
      expect(html).toContain(rule.condition);
      expect(html).toContain(rule.consequence);
    }

    for (const tier of REFUND_POLICY_DETAILS.bulkOrders) {
      expect(html).toContain(tier.notice);
      expect(html).toContain(tier.refundPercentage);
    }
  });

  it('uses >=44px interactive controls, >=14px typography, and CSS custom property theme tokens (zero sub-14px text)', () => {
    const pagePath = path.resolve(__dirname, '../app/refund-policy/page.tsx');
    const source = fs.readFileSync(pagePath, 'utf8');

    expect(source).toContain('min-h-[44px]');
    expect(source).toContain('var(--bg-primary)');
    expect(source).toContain('var(--bg-card)');
    expect(source).toContain('var(--text-primary)');
    expect(source).not.toMatch(/\btext-xs\b/);
    expect(source).not.toMatch(/text-\[1[0-3]px\]/);
  });

  it('registers /refund-policy in PUBLIC_ROUTES and sitemap, and links cleanly from checkout and menu', () => {
    expect(isPublicPath('/refund-policy')).toBe(true);
    expect(isPrivatePath('/refund-policy')).toBe(false);
    expect(PUBLIC_ROUTES.some((r) => r.path === '/refund-policy')).toBe(true);

    const entries = sitemap();
    expect(entries.some((e) => e.url.endsWith('/refund-policy'))).toBe(true);

    const checkoutSrc = fs.readFileSync(path.resolve(__dirname, '../app/checkout/page.tsx'), 'utf8');
    expect(checkoutSrc).toContain('href="/refund-policy"');

    const menuSrc = fs.readFileSync(path.resolve(__dirname, '../app/menu/page.tsx'), 'utf8');
    expect(menuSrc).toContain('href="/refund-policy"');
  });
});

describe('Refund Calculation Invariants (BigInt Kobo, Zero-Trust Boundaries)', () => {
  it('issues 0n when verifiedPaidKobo is 0n or negative even if business cancels', () => {
    const now = Date.now();
    const zeroPaid = calculateRefund({
      classification: 'fresh',
      foodSubtotalKobo: 500000n,
      deliveryFeeKobo: 150000n,
      verifiedPaidKobo: 0n,
      orderTimestampMs: now - 5 * 60 * 1000,
      cancellationTimestampMs: now,
      cookingStarted: false,
      cancelledByBusiness: true,
    });
    expect(zeroPaid.eligibleRefundKobo).toBe(0n);
    expect(zeroPaid.refundFoodKobo).toBe(0n);
    expect(zeroPaid.refundDeliveryKobo).toBe(0n);
  });

  it('caps any refund strictly at verifiedPaidKobo (prevents over-refund against partial deposit)', () => {
    const now = Date.now();
    // Bulk order 80% of ₦100,000 = ₦80,000, but customer only verified ₦50,000 deposit
    const capped = calculateRefund({
      classification: 'bulk',
      foodSubtotalKobo: 10000000n,
      deliveryFeeKobo: 2000000n,
      verifiedPaidKobo: 5000000n,
      orderTimestampMs: now - 3600000,
      cancellationTimestampMs: now,
      cookingStarted: false,
      eventDateTimestampMs: now + 80 * 3600 * 1000,
    });
    expect(capped.eligibleRefundKobo).toBe(5000000n);
    expect(capped.refundDeliveryKobo).toBe(0n);
  });

  it('throws explicitly if bulk refund is calculated without an eventDateTimestampMs', () => {
    const now = Date.now();
    expect(() =>
      calculateRefund({
        classification: 'bulk',
        foodSubtotalKobo: 10000000n,
        deliveryFeeKobo: 2000000n,
        verifiedPaidKobo: 7000000n,
        orderTimestampMs: now - 3600000,
        cancellationTimestampMs: now,
        cookingStarted: false,
      })
    ).toThrow(/Event date timestamp is required/);
  });

  it('enforces exact tier boundaries on fresh 30-min threshold and bulk 24/48/72h thresholds', () => {
    expect(classifyOrder(20, false)).toBe('fresh');
    expect(classifyOrder(21, false)).toBe('bulk');
    expect(classifyOrder(1, true)).toBe('bulk');

    expect(bulkRefundBps(72)).toBe(8000);
    expect(bulkRefundBps(48)).toBe(5000);
    expect(bulkRefundBps(24)).toBe(2500);
    expect(bulkRefundBps(23.999)).toBe(0);

    const now = 1_760_000_000_000;
    const exact30 = calculateRefund({
      classification: 'fresh',
      foodSubtotalKobo: 400000n,
      deliveryFeeKobo: 100000n,
      verifiedPaidKobo: 500000n,
      orderTimestampMs: now - 30 * 60 * 1000,
      cancellationTimestampMs: now,
      cookingStarted: false,
    });
    expect(exact30.eligibleRefundKobo).toBe(500000n);

    const past30 = calculateRefund({
      classification: 'fresh',
      foodSubtotalKobo: 400000n,
      deliveryFeeKobo: 100000n,
      verifiedPaidKobo: 500000n,
      orderTimestampMs: now - (30 * 60 * 1000 + 1),
      cancellationTimestampMs: now,
      cookingStarted: false,
    });
    expect(past30.eligibleRefundKobo).toBe(0n);
  });
});
