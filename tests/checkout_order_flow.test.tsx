/**
 * ROCK UC FOODS - Customer Menu, Cart, Checkout & Order Tracking Audit Tests
 * Covers Section 35 rules (Dark/Light tokens, >=14px text, >=44px controls, a11y labels),
 * CartProvider SSR hydration safety, DishCustomizerModal stale-state prevention,
 * and end-to-end zero-trust order + proof validation.
 */

import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import * as fs from 'fs';
import * as path from 'path';

import { DishCard } from '../src/components/menu/DishCard';
import { ContactFooter } from '../src/components/brand/ContactFooter';
import { getActiveMenuWithDetails } from '../src/menu/read-model';
import { orderRepository } from '../src/order/orderRepository';
import { createOrder } from '../src/order/orderEngine';
import { submitOrderPaymentProof } from '../src/payment/paymentEngine';
import { POLICY_VERSION } from '../src/policy/content';

const AUDITED_FILES = [
  '../app/menu/page.tsx',
  '../app/checkout/page.tsx',
  '../app/order/[code]/page.tsx',
  '../src/components/order/CartDrawer.tsx',
  '../src/components/order/CartFloatBar.tsx',
  '../src/components/order/DishCustomizerModal.tsx',
  '../src/components/menu/DishCard.tsx',
  '../src/components/menu/DishPhotoModal.tsx',
  '../src/components/brand/ContactFooter.tsx',
];

describe('Checkout, Order Tracking & Menu Section 35 Compliance', () => {
  it('enforces >=14px typography and Dark/Light CSS tokens across all audited customer flow files', () => {
    for (const rel of AUDITED_FILES) {
      const fullPath = path.resolve(__dirname, rel);
      const src = fs.readFileSync(fullPath, 'utf8');

      expect(src, `${rel} must not contain sub-14px text-xs`).not.toMatch(/\btext-xs\b/);
      expect(src, `${rel} must not contain text-[9px..13px]`).not.toMatch(/text-\[(?:9|1[0-3])px\]/);
      expect(src, `${rel} must reference semantic --bg-* variables`).toMatch(/var\(--bg-/);
      expect(src, `${rel} must reference semantic --text-* variables`).toMatch(/var\(--text-/);
      expect(src, `${rel} must enforce >=44px touch targets`).toMatch(
        /min-h-\[(?:44|48|56)px\]|h-11|w-11/
      );
    }
  });

  it('pairs form labels with htmlFor/id and adds role=alert on checkout & proof error containers', () => {
    const checkoutSrc = fs.readFileSync(path.resolve(__dirname, '../app/checkout/page.tsx'), 'utf8');
    expect(checkoutSrc).toContain('htmlFor="checkout-name"');
    expect(checkoutSrc).toContain('id="checkout-name"');
    expect(checkoutSrc).toContain('htmlFor="checkout-phone"');
    expect(checkoutSrc).toContain('id="checkout-phone"');
    expect(checkoutSrc).toContain('htmlFor="checkout-policy"');
    expect(checkoutSrc).toContain('id="checkout-policy"');
    expect(checkoutSrc).toContain('role="alert"');

    const orderSrc = fs.readFileSync(
      path.resolve(__dirname, '../app/order/[code]/page.tsx'),
      'utf8'
    );
    expect(orderSrc).toContain('htmlFor="proof-sender-name"');
    expect(orderSrc).toContain('id="proof-sender-name"');
    expect(orderSrc).toContain('htmlFor="proof-transfer-time"');
    expect(orderSrc).toContain('id="proof-transfer-time"');
    expect(orderSrc).toContain('htmlFor="proof-receipt-file"');
    expect(orderSrc).toContain('id="proof-receipt-file"');
    expect(orderSrc).toContain('role="alert"');
  });

  it('prevents stale DishCustomizerModal state across dishes and avoids SSR localStorage mismatch in CartProvider', () => {
    const customizerSrc = fs.readFileSync(
      path.resolve(__dirname, '../src/components/order/DishCustomizerModal.tsx'),
      'utf8'
    );
    // Must reset state cleanly via keyed dialog mount when isOpen or dish changes
    expect(customizerSrc).toContain('<DishCustomizerDialog key={dish.id}');
    expect(customizerSrc).toContain('useState<string>(() => getInitialTierId(dish))');
    expect(customizerSrc).toContain('getInitialOptionIds(dish)');
    expect(customizerSrc).toContain('useState<number>(1)');

    const cartSrc = fs.readFileSync(
      path.resolve(__dirname, '../src/order/cartContext.tsx'),
      'utf8'
    );
    expect(cartSrc).toContain('hasHydratedRef');
    expect(cartSrc).toMatch(/useState<StoredCartEntry\[\]>\(\[\]\)/);
  });

  it('renders DishCard and ContactFooter cleanly without dead links or NGN currency codes', () => {
    const items = getActiveMenuWithDetails();
    expect(items.length).toBeGreaterThan(0);

    const cardHtml = renderToStaticMarkup(<DishCard item={items[0]} />);
    expect(cardHtml).toContain('var(--bg-card)');
    expect(cardHtml).not.toContain('href="#"');
    expect(cardHtml).not.toMatch(/\bNGN\b/);

    const footerHtml = renderToStaticMarkup(<ContactFooter />);
    expect(footerHtml).toContain('href="/refund-policy"');
    expect(footerHtml).toContain('var(--bg-card)');
    expect(footerHtml).not.toContain('href="#"');
  });
});

describe('Order & Proof Edge-Case Invariants (Duplicate Receipt Hash & Expired Order)', () => {
  beforeEach(() => {
    orderRepository.clear();
  });

  it('blocks duplicate receipt file SHA-256 across different orders and blocks expired orders', () => {
    const order1 = createOrder({
      customerName: 'Amaka Nwosu',
      customerPhone: '08033729125',
      deliveryType: 'collection',
      acceptedPolicy: true,
      policyVersion: POLICY_VERSION,
      items: [{ menuItemId: 'item-t001', quantity: 1 }],
    });

    const order2 = createOrder({
      customerName: 'Chinedu Okafor',
      customerPhone: '08033729126',
      deliveryType: 'collection',
      acceptedPolicy: true,
      policyVersion: POLICY_VERSION,
      items: [{ menuItemId: 'item-t001', quantity: 1 }],
    });

    const pngHeader = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);

    const first = submitOrderPaymentProof({
      orderId: order1.id,
      orderCode: order1.orderCode,
      senderName: 'Amaka Nwosu',
      transferTime: new Date().toISOString(),
      paymentReference: order1.paymentReference,
      receiptFile: {
        fileName: 'receipt.png',
        mimeType: 'image/png',
        sizeBytes: pngHeader.byteLength,
        buffer: pngHeader,
      },
    });
    expect(first.order.status).toBe('proof_submitted');

    // Reusing the exact same receipt image on a different order must be blocked
    expect(() =>
      submitOrderPaymentProof({
        orderId: order2.id,
        orderCode: order2.orderCode,
        senderName: 'Chinedu Okafor',
        transferTime: new Date().toISOString(),
        paymentReference: order2.paymentReference,
        receiptFile: {
          fileName: 'receipt-copy.png',
          mimeType: 'image/png',
          sizeBytes: pngHeader.byteLength,
          buffer: pngHeader,
        },
      })
    ).toThrow(/Duplicate proof/i);

    // Expired order cannot accept payment proof
    orderRepository.updateStatus(order1.id, 'expired');
    expect(() =>
      submitOrderPaymentProof({
        orderId: order1.id,
        orderCode: order1.orderCode,
        senderName: 'Amaka Nwosu',
        transferTime: new Date().toISOString(),
      })
    ).toThrow(/expired/i);
  });
});
