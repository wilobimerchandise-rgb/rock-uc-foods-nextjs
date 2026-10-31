/**
 * ROCK UC FOODS - Automated Customer Notifications Tests
 * Playbook v4 Section 25
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { normalizeNigerianPhone } from '../src/notifications/phone';
import {
  renderOrderTemplate,
  renderCateringTemplate,
  buildWhatsAppUrl,
} from '../src/notifications/templates';
import {
  notificationRepository,
  sendOrderNotification,
  sendCateringNotification,
} from '../src/notifications/notificationEngine';
import { Order } from '../src/types/order';
import { Invoice } from '../src/types/invoice';

describe('Playbook Section 25: Automated Customer Notifications & Alerts', () => {
  beforeEach(() => {
    notificationRepository.clear();
  });

  describe('1. Nigerian Phone Normalization & Telco Identification', () => {
    it('normalizes 11-digit local format (0803...) into E.164 and identifies MTN', () => {
      const res = normalizeNigerianPhone('08033729125');
      expect(res.valid).toBe(true);
      expect(res.e164).toBe('+2348033729125');
      expect(res.national).toBe('08033729125');
      expect(res.telco).toBe('MTN');
    });

    it('normalizes +234 E.164 format and identifies Airtel', () => {
      const res = normalizeNigerianPhone('+2348021112233');
      expect(res.valid).toBe(true);
      expect(res.e164).toBe('+2348021112233');
      expect(res.national).toBe('08021112233');
      expect(res.telco).toBe('Airtel');
    });

    it('normalizes 234 prefix without plus and identifies Glo', () => {
      const res = normalizeNigerianPhone('2348059998877');
      expect(res.valid).toBe(true);
      expect(res.e164).toBe('+2348059998877');
      expect(res.national).toBe('08059998877');
      expect(res.telco).toBe('Glo');
    });

    it('cleans non-numeric formatting like spaces, hyphens, and brackets and identifies 9mobile', () => {
      const res = normalizeNigerianPhone('(0809) 123-4567');
      expect(res.valid).toBe(true);
      expect(res.e164).toBe('+2348091234567');
      expect(res.national).toBe('08091234567');
      expect(res.telco).toBe('9mobile');
    });

    it('rejects invalid lengths or non-numeric strings', () => {
      expect(normalizeNigerianPhone('12345').valid).toBe(false);
      expect(normalizeNigerianPhone('080312345678999').valid).toBe(false);
      expect(normalizeNigerianPhone('').valid).toBe(false);
    });
  });

  describe('2. Order Notification Templates (Brand Voice & Strict Naira)', () => {
    const sampleOrder: Order = {
      id: 'ord-notif-01',
      orderCode: 'ROC-20261029-KING',
      trackingToken: 'tok-notif-1234',
      customerName: 'Chidiebere Okonkwo',
      customerPhone: '08033729125',
      deliveryType: 'delivery',
      deliveryAddress: 'Plot 12, Victoria Island, Lagos',
      status: 'pending_payment',
      policyVersion: 'v4.0',
      policyAcceptedAt: new Date().toISOString(),
      items: [
        {
          id: 'item-01',
          orderId: 'ord-notif-01',
          menuItemId: 'dish-01',
          nameSnapshot: 'Signature Luxury Jollof Rice',
          portionSnapshot: 'Serves 1',
          unitPriceKoboSnapshot: 450000n,
          quantity: 1,
          totalKoboSnapshot: 450000n,
        },
      ],
      subtotalKobo: 450000n,
      deliveryFeeKobo: 100000n,
      totalKobo: 550000n, // ₦5,500.00
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    it('renders order_confirmed with exact ₦5,500.00 and zero NGN wording', () => {
      const rendered = renderOrderTemplate('order_confirmed', sampleOrder);

      expect(rendered.plainText).toContain('₦5,500.00');
      expect(rendered.plainText).not.toContain('NGN');
      expect(rendered.plainText).toContain('Chidiebere');
      expect(rendered.plainText).toContain('#ROC-20261029-KING');

      expect(rendered.whatsAppText).toContain('*₦5,500.00*');
      expect(rendered.whatsAppText).toContain('Plot 12, Victoria Island, Lagos');
    });

    it('renders in_kitchen with Chef Esther culinary branding', () => {
      const rendered = renderOrderTemplate('in_kitchen', sampleOrder);

      expect(rendered.plainText).toContain('pot is on the fire');
      expect(rendered.plainText).toContain('pure olive oil');
      expect(rendered.whatsAppText).toContain('Chef Esther');
    });

    it('renders out_for_delivery with destination address and rider contact', () => {
      const rendered = renderOrderTemplate('out_for_delivery', sampleOrder);

      expect(rendered.plainText).toContain('08033729125');
      expect(rendered.whatsAppText).toContain('Plot 12, Victoria Island, Lagos');
    });

    it('renders delivered with gratitude and digital receipt', () => {
      const rendered = renderOrderTemplate('delivered', sampleOrder);

      expect(rendered.plainText).toContain('has been delivered');
      expect(rendered.plainText).toContain('dining with Chef Esther');
    });

    it('builds valid WhatsApp direct URL', () => {
      const url = buildWhatsAppUrl('+2348033729125', 'Hello Chef Esther');
      expect(url).toBe('https://wa.me/2348033729125?text=Hello%20Chef%20Esther');
    });
  });

  describe('3. Catering Notification Templates', () => {
    const sampleInvoice: Invoice = {
      id: 'inv-cat-01',
      invoiceNumber: 'INV-20261029-ROYAL',
      publicToken: 'tok-inv-1234567890abcdef',
      orderId: 'evt-01',
      clientName: 'Prince Adebayo',
      clientPhone: '08021112233',
      revisionNumber: 1,
      items: [
        {
          id: 'item-01',
          invoiceId: 'inv-cat-01',
          nameSnapshot: 'Royal Banquet Package',
          unitPriceKobo: 2600000n,
          quantity: 100,
          lineTotalKobo: 260000000n,
        },
      ],
      subtotalKobo: 260000000n, // ₦2,600,000.00
      deliveryFeeKobo: 5000000n, // ₦50,000.00
      discountKobo: 0n,
      taxKobo: 26000000n,
      totalKobo: 291000000n, // ₦2,910,000.00
      depositKobo: 203700000n, // ₦2,037,000.00 (70%)
      balanceKobo: 87300000n, // ₦873,000.00 (30%)
      status: 'issued',
      bankDetails: {
        bankName: 'Moniepoint MFB',
        accountNumber: '6625890251',
        accountName: 'ROCK UC FOODS',
        verifiedByOwner: true,
      },
      paymentTerms: '70% deposit to confirm date, 30% balance upon delivery.',
      dueDate: '2026-11-15',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    it('renders catering_invoice_sent with 70% deposit and 30% balance', () => {
      const rendered = renderCateringTemplate('catering_invoice_sent', sampleInvoice);

      expect(rendered.plainText).toContain('₦2,910,000.00');
      expect(rendered.plainText).toContain('₦2,037,000.00 (70%)');
      expect(rendered.plainText).toContain('₦873,000.00');

      expect(rendered.whatsAppText).toContain('6625890251');
      expect(rendered.whatsAppText).toContain('Moniepoint MFB');
    });

    it('renders catering_receipt_sent with date confirmation', () => {
      const rendered = renderCateringTemplate('catering_receipt_sent', sampleInvoice);

      expect(rendered.plainText).toContain('event date is secured');
      expect(rendered.plainText).toContain('₦2,037,000.00');
    });
  });

  describe('4. Notification Outbox & Dispatch Queue', () => {
    const sampleOrder: Order = {
      id: 'ord-queue-01',
      orderCode: 'ROC-20261029-QUEUE',
      trackingToken: 'tok-q',
      customerName: 'Fatima Sanusi',
      customerPhone: '08059998877',
      deliveryType: 'delivery',
      deliveryAddress: 'Ikeja, Lagos',
      status: 'payment_confirmed',
      policyVersion: 'v4.0',
      policyAcceptedAt: new Date().toISOString(),
      items: [],
      subtotalKobo: 300000n,
      deliveryFeeKobo: 100000n,
      totalKobo: 400000n,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    it('enqueues and dispatches WhatsApp notification into outbox', () => {
      const notif = sendOrderNotification(sampleOrder, 'order_confirmed', 'whatsapp');

      expect(notif.id).toBeDefined();
      expect(notif.status).toBe('sent');
      expect(notif.recipientPhone).toBe('+2348059998877');
      expect(notif.message).toContain('ROC-20261029-QUEUE');
      expect(notif.whatsAppUrl).toContain('https://wa.me/2348059998877');

      const saved = notificationRepository.getNotificationsForOrder(sampleOrder.id);
      expect(saved.length).toBe(1);
      expect(saved[0].id).toBe(notif.id);
    });

    it('dispatches SMS notification into outbox with plain text formatting', () => {
      const notif = sendOrderNotification(sampleOrder, 'out_for_delivery', 'sms');

      expect(notif.channel).toBe('sms');
      expect(notif.message).toContain('ROCK UC FOODS:');
      expect(notif.message).not.toContain('*'); // Plain text has no markdown asterisks
    });
  });
});
