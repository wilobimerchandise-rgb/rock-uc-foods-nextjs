/**
 * ROCK UC FOODS - Invoice & Receipt PDF Document
 * Playbook v4 Section 22
 * 
 * Strict geometry:
 * - A4 (595.28 x 841.89 pt) with 36pt margin -> 523.28pt content width.
 * - Right page margin at x = 559.28pt.
 * - Columns: Items 233pt, Qty 50pt, Unit Price 110pt, Line Total 130pt (sum = 523pt).
 * - Totals block: 373pt wide (Label 233pt, Amount 140pt).
 * - Grand total wine bar (#6B1230) has 8pt right padding -> figure ends <= 551.28pt.
 * - Refuses any total above 10,000,000,000 kobo (₦100,000,000.00).
 * - Never prints 'NGN'.
 */

import React from 'react';
import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
  pdf,
} from '@react-pdf/renderer';
import { registerPdfFonts } from './fonts';
import { MoneyCell } from './Money';
import { MAX_KOBO, lineTotal, splitDeposit, formatNaira } from '../money';
import { INVOICE_FOOTER, ALLERGEN_NOTICE, BUSINESS_CONTACT } from '../../policy/content';

export interface InvoicePdfItem {
  name: string;
  quantity: number;
  unitPriceKobo: bigint;
}

export interface InvoicePdfData {
  invoiceNumber: string;
  clientName: string;
  clientPhone: string;
  clientEmail?: string;
  eventDate?: string;
  items: InvoicePdfItem[];
  deliveryFeeKobo?: bigint;
  serviceChargeKobo?: bigint;
}

const COLOR_WINE = '#6B1230';
const COLOR_GOLD = '#D4AF37';
const COLOR_CREAM = '#F7EFD9';
const COLOR_INK = '#0B0A09';
const COLOR_MUTED = '#5A504B';

const styles = StyleSheet.create({
  page: {
    width: 595.28,
    height: 841.89,
    paddingTop: 36,
    paddingBottom: 36,
    paddingLeft: 36,
    paddingRight: 36,
    backgroundColor: '#FFFFFF',
    fontFamily: 'Inter',
  },
  headerBand: {
    backgroundColor: COLOR_WINE,
    padding: 16,
    borderRadius: 4,
    marginBottom: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    color: COLOR_GOLD,
    fontSize: 10,
    marginTop: 2,
  },
  invoiceMeta: {
    alignItems: 'flex-end',
  },
  invoiceNumberText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  clientSection: {
    marginBottom: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E0D8',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  clientLabel: {
    fontSize: 8,
    color: COLOR_MUTED,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  clientValue: {
    fontSize: 10,
    color: COLOR_INK,
    fontWeight: 'bold',
  },
  table: {
    width: 523,
    marginBottom: 16,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: COLOR_CREAM,
    borderBottomWidth: 1,
    borderBottomColor: COLOR_GOLD,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  thText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: COLOR_INK,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E0D8',
    paddingVertical: 6,
    paddingHorizontal: 4,
    alignItems: 'center',
  },
  colItem: {
    width: 233,
  },
  colQty: {
    width: 50,
    textAlign: 'center',
  },
  colUnitPrice: {
    width: 110,
    paddingRight: 8,
  },
  colLineTotal: {
    width: 130,
    paddingRight: 4,
  },
  totalsContainer: {
    width: 523,
    alignItems: 'flex-end',
    marginBottom: 20,
  },
  totalsBlock: {
    width: 373,
  },
  totalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  totalsLabel: {
    width: 233,
    fontSize: 9,
    color: COLOR_INK,
  },
  grandTotalBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: COLOR_WINE,
    paddingVertical: 6,
    paddingLeft: 8,
    paddingRight: 8, // 8pt padding inside wine bar
    borderRadius: 3,
    marginTop: 4,
    marginBottom: 4,
  },
  grandTotalLabel: {
    width: 225,
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
  policySection: {
    marginTop: 'auto',
    borderTopWidth: 1,
    borderTopColor: COLOR_GOLD,
    paddingTop: 10,
  },
  allergenBox: {
    backgroundColor: COLOR_CREAM,
    padding: 8,
    borderRadius: 3,
    marginBottom: 8,
  },
  allergenText: {
    fontSize: 7.5,
    color: COLOR_INK,
    lineHeight: 1.3,
  },
  footerText: {
    fontSize: 7,
    color: COLOR_MUTED,
    lineHeight: 1.3,
  },
});

export const InvoiceDocument: React.FC<{ data: InvoicePdfData }> = ({ data }) => {
  registerPdfFonts();

  let subtotalKobo = 0n;
  for (const item of data.items) {
    subtotalKobo += lineTotal(item.unitPriceKobo, item.quantity);
  }

  const deliveryFeeKobo = data.deliveryFeeKobo ?? 0n;
  const serviceChargeKobo = data.serviceChargeKobo ?? 0n;
  const totalKobo = subtotalKobo + deliveryFeeKobo + serviceChargeKobo;

  // Refuse any total above 10,000,000,000 kobo (100 million naira)
  if (totalKobo > MAX_KOBO) {
    throw new Error(
      `Invoice total ${formatNaira(totalKobo)} exceeds maximum allowed limit of ${formatNaira(MAX_KOBO)}.`
    );
  }

  const { depositKobo, balanceKobo } = splitDeposit(totalKobo, 7000);

  return (
    <Document title={`Invoice ${data.invoiceNumber}`}>
      <Page size="A4" style={styles.page}>
        {/* Header Band */}
        <View style={styles.headerBand}>
          <View>
            <Text style={styles.headerTitle}>{BUSINESS_CONTACT.name}</Text>
            <Text style={styles.headerSubtitle}>{BUSINESS_CONTACT.tagline}</Text>
          </View>
          <View style={styles.invoiceMeta}>
            <Text style={styles.invoiceNumberText}>{data.invoiceNumber}</Text>
            <Text style={{ color: '#FFFFFF', fontSize: 8, marginTop: 2 }}>
              {BUSINESS_CONTACT.location} | Tel: {BUSINESS_CONTACT.phone}
            </Text>
          </View>
        </View>

        {/* Client Details */}
        <View style={styles.clientSection}>
          <View>
            <Text style={styles.clientLabel}>Billed To</Text>
            <Text style={styles.clientValue}>{data.clientName}</Text>
            <Text style={{ fontSize: 9, color: COLOR_MUTED, marginTop: 1 }}>
              {data.clientPhone}
            </Text>
          </View>
          {data.eventDate && (
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.clientLabel}>Event Date</Text>
              <Text style={styles.clientValue}>{data.eventDate}</Text>
            </View>
          )}
        </View>

        {/* Line Items Table (523pt total width) */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.thText, styles.colItem]}>Item Description</Text>
            <Text style={[styles.thText, styles.colQty]}>Qty</Text>
            <Text style={[styles.thText, styles.colUnitPrice, { textAlign: 'right' }]}>
              Unit Price
            </Text>
            <Text style={[styles.thText, styles.colLineTotal, { textAlign: 'right' }]}>
              Line Total
            </Text>
          </View>

          {data.items.map((item, idx) => {
            const itemTotal = lineTotal(item.unitPriceKobo, item.quantity);
            return (
              <View key={idx} style={styles.tableRow}>
                <View style={styles.colItem}>
                  <Text style={{ fontSize: 9, color: COLOR_INK }}>{item.name}</Text>
                </View>
                <View style={styles.colQty}>
                  <Text style={{ fontSize: 9, color: COLOR_INK, textAlign: 'center' }}>
                    {item.quantity}
                  </Text>
                </View>
                <View style={styles.colUnitPrice}>
                  <MoneyCell
                    amountKobo={item.unitPriceKobo}
                    width={102}
                    color={COLOR_INK}
                    maxFontSize={9}
                  />
                </View>
                <View style={styles.colLineTotal}>
                  <MoneyCell
                    amountKobo={itemTotal}
                    width={126}
                    color={COLOR_INK}
                    maxFontSize={9}
                  />
                </View>
              </View>
            );
          })}
        </View>

        {/* Totals Block (373pt total width) */}
        <View style={styles.totalsContainer}>
          <View style={styles.totalsBlock}>
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Food Subtotal</Text>
              <MoneyCell amountKobo={subtotalKobo} width={140} maxFontSize={9} />
            </View>

            {deliveryFeeKobo > 0n && (
              <View style={styles.totalsRow}>
                <Text style={styles.totalsLabel}>Delivery &amp; Logistics</Text>
                <MoneyCell amountKobo={deliveryFeeKobo} width={140} maxFontSize={9} />
              </View>
            )}

            {serviceChargeKobo > 0n && (
              <View style={styles.totalsRow}>
                <Text style={styles.totalsLabel}>Service Charge</Text>
                <MoneyCell amountKobo={serviceChargeKobo} width={140} maxFontSize={9} />
              </View>
            )}

            {/* Grand Total Bar in Wine (#6B1230) */}
            <View style={styles.grandTotalBar}>
              <Text style={styles.grandTotalLabel}>GRAND TOTAL</Text>
              <MoneyCell
                amountKobo={totalKobo}
                width={132}
                bold
                color="#FFFFFF"
                maxFontSize={11}
              />
            </View>

            {/* 70/30 Deposit and Balance */}
            <View style={styles.totalsRow}>
              <Text style={[styles.totalsLabel, { fontWeight: 'bold' }]}>70% Deposit Required</Text>
              <MoneyCell amountKobo={depositKobo} width={140} bold maxFontSize={9} />
            </View>
            <View style={styles.totalsRow}>
              <Text style={[styles.totalsLabel, { color: COLOR_MUTED }]}>30% Balance on Delivery</Text>
              <MoneyCell amountKobo={balanceKobo} width={140} color={COLOR_MUTED} maxFontSize={9} />
            </View>
          </View>
        </View>

        {/* Policy & Allergen Footers */}
        <View style={styles.policySection}>
          <View style={styles.allergenBox}>
            <Text style={styles.allergenText}>{ALLERGEN_NOTICE}</Text>
          </View>
          <Text style={styles.footerText}>{INVOICE_FOOTER}</Text>
        </View>
      </Page>
    </Document>
  );
};

export async function renderInvoicePdfBuffer(data: InvoicePdfData): Promise<Buffer> {
  let subtotalKobo = 0n;
  for (const item of data.items) {
    subtotalKobo += lineTotal(item.unitPriceKobo, item.quantity);
  }
  const deliveryFeeKobo = data.deliveryFeeKobo ?? 0n;
  const serviceChargeKobo = data.serviceChargeKobo ?? 0n;
  const totalKobo = subtotalKobo + deliveryFeeKobo + serviceChargeKobo;

  if (totalKobo > MAX_KOBO) {
    throw new Error(
      `Invoice total ${formatNaira(totalKobo)} exceeds maximum allowed limit of ${formatNaira(MAX_KOBO)}.`
    );
  }

  const doc = <InvoiceDocument data={data} />;
  const stream = await pdf(doc).toBuffer();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}
