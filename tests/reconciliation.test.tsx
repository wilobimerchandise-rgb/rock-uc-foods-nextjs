/**
 * ROCK UC FOODS - Bank Reconciliation Unit & Integration Tests
 * Playbook v4 Section 21
 */

import { describe, it, expect } from 'vitest';
import {
  extractOrderReference,
  parseStatementCsv,
  reconcileTransactions,
} from '../src/payment/reconciliation';
import { Order } from '../src/types/order';

describe('Playbook Section 21: Bank Statement Reconciliation', () => {
  describe('1. Nigerian Bank Narration Reference Extraction', () => {
    it('extracts ROC order codes from standard NIP/Transfer strings', () => {
      expect(
        extractOrderReference('TRF/ROC-20261028-ABCD/CHIDIEBERE/GTB')
      ).toBe('ROC-20261028-ABCD');

      expect(
        extractOrderReference('NIP/ESTHER/ROC-20261028-WXYZ/LUNCH')
      ).toBe('ROC-20261028-WXYZ');

      expect(
        extractOrderReference('TRANSFER FROM OLUWASEUN ROC-20261028-PARTIAL')
      ).toBe('ROC-20261028-PARTIAL');
    });

    it('extracts EVT catering invoice codes', () => {
      expect(
        extractOrderReference('PAYMENT FOR EVENT EVT-20261019-MXTF DEPOSIT')
      ).toBe('EVT-20261019-MXTF');
    });

    it('returns null for generic transactions without order codes', () => {
      expect(extractOrderReference('POS CASH SETTLEMENT UNKNOWN SENDER')).toBeNull();
      expect(extractOrderReference('INTEREST PAYMENT FROM MONIEPOINT')).toBeNull();
    });
  });

  describe('2. Bank Statement CSV Parser', () => {
    it('parses valid Moniepoint CSV rows with BigInt kobo precision', () => {
      const csv = `Date,Reference,Narration,Amount,Balance
2026-10-28,MNP-01,"TRF/ROC-20261028-ABCD/CHIDIEBERE",18500.00,1250000.00
2026-10-28,MNP-02,"NIP/ESTHER/ROC-20261028-WXYZ/LUNCH",3500.00,1253500.00`;

      const txns = parseStatementCsv(csv, 'Moniepoint');
      expect(txns.length).toBe(2);
      expect(txns[0].amountKobo).toBe(1850000n); // ₦18,500.00
      expect(txns[0].extractedRef).toBe('ROC-20261028-ABCD');
      expect(txns[1].amountKobo).toBe(350000n); // ₦3,500.00
      expect(txns[1].extractedRef).toBe('ROC-20261028-WXYZ');
    });

    it('handles empty or whitespace CSV text gracefully', () => {
      expect(parseStatementCsv('')).toEqual([]);
      expect(parseStatementCsv('   \n  ')).toEqual([]);
    });
  });

  describe('3. Matching Engine & Discrepancy Classification', () => {
    const orders: Order[] = [
      {
        id: 'ord-01',
        orderCode: 'ROC-20261028-EXACT',
        trackingToken: 'token1',
        customerName: 'Amina Bello',
        customerPhone: '08031112233',
        deliveryType: 'delivery',
        deliveryAddress: 'Lekki Phase 1',
        status: 'pending_payment',
        policyVersion: 'v4.0',
        policyAcceptedAt: new Date().toISOString(),
        items: [],
        subtotalKobo: 500000n,
        deliveryFeeKobo: 100000n,
        totalKobo: 600000n, // ₦6,000.00
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'ord-02',
        orderCode: 'ROC-20261028-SHORT',
        trackingToken: 'token2',
        customerName: 'Emeka Obi',
        customerPhone: '08032223344',
        deliveryType: 'delivery',
        deliveryAddress: 'Ikeja GRA',
        status: 'pending_payment',
        policyVersion: 'v4.0',
        policyAcceptedAt: new Date().toISOString(),
        items: [],
        subtotalKobo: 900000n,
        deliveryFeeKobo: 100000n,
        totalKobo: 1000000n, // ₦10,000.00
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'ord-03',
        orderCode: 'ROC-20261028-OVER',
        trackingToken: 'token3',
        customerName: 'Babatunde Ade',
        customerPhone: '08033334455',
        deliveryType: 'delivery',
        deliveryAddress: 'Ikoyi',
        status: 'pending_payment',
        policyVersion: 'v4.0',
        policyAcceptedAt: new Date().toISOString(),
        items: [],
        subtotalKobo: 400000n,
        deliveryFeeKobo: 100000n,
        totalKobo: 500000n, // ₦5,000.00
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'ord-04',
        orderCode: 'ROC-20261028-PAID',
        trackingToken: 'token4',
        customerName: 'Chioma Eze',
        customerPhone: '08034445566',
        deliveryType: 'delivery',
        deliveryAddress: 'Surulere',
        status: 'in_kitchen', // Already paid
        policyVersion: 'v4.0',
        policyAcceptedAt: new Date().toISOString(),
        items: [],
        subtotalKobo: 300000n,
        deliveryFeeKobo: 100000n,
        totalKobo: 400000n, // ₦4,000.00
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    it('correctly classifies exact match, underpaid, overpaid, already paid, and unmatched', () => {
      const parsedTxns = [
        {
          id: 't-1',
          date: '2026-10-28',
          narration: 'TRF ROC-20261028-EXACT AMINA',
          amountKobo: 600000n, // Exactly matches ord-01
          extractedRef: 'ROC-20261028-EXACT',
        },
        {
          id: 't-2',
          date: '2026-10-28',
          narration: 'TRANSFER ROC-20261028-SHORT EMEKA',
          amountKobo: 700000n, // Short by ₦3,000.00
          extractedRef: 'ROC-20261028-SHORT',
        },
        {
          id: 't-3',
          date: '2026-10-28',
          narration: 'TRF ROC-20261028-OVER BABATUNDE',
          amountKobo: 600000n, // Over by ₦1,000.00
          extractedRef: 'ROC-20261028-OVER',
        },
        {
          id: 't-4',
          date: '2026-10-28',
          narration: 'TRF ROC-20261028-PAID CHIOMA',
          amountKobo: 400000n, // Order is already cooking
          extractedRef: 'ROC-20261028-PAID',
        },
        {
          id: 't-5',
          date: '2026-10-28',
          narration: 'UNKNOWN CASH DEPOSIT',
          amountKobo: 1500000n, // No ref found
          extractedRef: null,
        },
      ];

      const result = reconcileTransactions(parsedTxns, orders);

      expect(result.totalTransactions).toBe(5);
      expect(result.exactMatchCount).toBe(1);
      expect(result.discrepancyCount).toBe(3); // short, over, already_paid
      expect(result.unmatchedCount).toBe(1);

      // Verify specific statuses
      expect(result.lines[0].status).toBe('reconciled_exact');
      expect(result.lines[1].status).toBe('underpaid');
      expect(result.lines[1].differenceKobo).toBe(300000n); // ₦3,000.00
      expect(result.lines[2].status).toBe('overpaid');
      expect(result.lines[2].differenceKobo).toBe(100000n); // ₦1,000.00
      expect(result.lines[3].status).toBe('already_paid');
      expect(result.lines[4].status).toBe('unmatched');

      // Verify mathematical reconciliation identity
      expect(result.reconciliationIdentityVerified).toBe(true);
      expect(
        result.exactMatchedKobo +
          result.unmatchedKobo +
          result.underpaidKobo +
          result.overpaidKobo +
          result.alreadyPaidKobo
      ).toBe(result.totalCreditsKobo);
    });
  });
});
