/**
 * ROCK UC FOODS - Notification Templates & WhatsApp Link Generator
 * Playbook v4 Section 25
 * 
 * Rules:
 * - 100% BigInt kobo formatted via formatNaira (never "NGN").
 * - Regal luxury tone reflecting Chef Esther & ROCK UC FOODS culinary standards.
 * - Formats plain text for SMS and Markdown for WhatsApp.
 */

import { formatNaira } from '../lib/money';
import { Order } from '../types/order';
import { Invoice, Receipt } from '../types/invoice';
import { NotificationEventType } from '../types/notification';
import { normalizeNigerianPhone } from './phone';

export interface RenderedTemplate {
  plainText: string;
  whatsAppText: string;
  whatsAppUrl: string;
}

/**
 * Builds the official WhatsApp direct click-to-chat URL.
 */
export function buildWhatsAppUrl(recipientPhone: string, messageText: string): string {
  const norm = normalizeNigerianPhone(recipientPhone);
  const cleanPhone = norm.valid ? norm.e164.replace(/\D/g, '') : recipientPhone.replace(/\D/g, '');
  const encodedText = encodeURIComponent(messageText);
  return `https://wa.me/${cleanPhone}?text=${encodedText}`;
}

/**
 * Renders templates for order lifecycle status changes.
 */
export function renderOrderTemplate(
  eventType: NotificationEventType,
  order: Order,
  customNote?: string
): RenderedTemplate {
  const trackingUrl = `https://rockucfoods.com/track?token=${order.trackingToken || order.orderCode}`;
  const totalFormatted = formatNaira(order.totalKobo);
  const firstName = order.customerName.split(' ')[0] || order.customerName;

  let plainText = '';
  let whatsAppText = '';

  switch (eventType) {
    case 'order_confirmed':
      plainText = `ROCK UC FOODS: Greetings ${firstName}, payment for order #${order.orderCode} (${totalFormatted}) has been confirmed! Chef Esther has scheduled your order. Track: ${trackingUrl}`;
      whatsAppText = `👑 *ROCK UC FOODS - Order Confirmed*\n\nWarmest greetings, *${firstName}*!\n\nYour payment of *${totalFormatted}* for order *#${order.orderCode}* has been verified and confirmed.\n\n📍 *Delivery Address:* ${order.deliveryAddress || 'Pickup at Kitchen'}\n⏱ *Est. Delivery:* 45-60 minutes\n\n🔗 *Track Live Order:* ${trackingUrl}\n\n_Thank you for choosing pure Nigerian luxury culinary excellence._`;
      break;

    case 'in_kitchen':
      plainText = `ROCK UC FOODS: Your pot is on the fire! Chef Esther and our team are now preparing order #${order.orderCode} with pure olive oil and authentic spices. Track: ${trackingUrl}`;
      whatsAppText = `🔥 *ROCK UC FOODS - In The Kitchen*\n\nHello *${firstName}*,\n\nYour pot is officially on the fire! Chef Esther has personally inspected your ingredients and your dishes for order *#${order.orderCode}* are currently being slow-simmered with premium extra virgin olive oil.\n\n🔗 *Track Live Progress:* ${trackingUrl}`;
      break;

    case 'ready_for_dispatch':
      plainText = `ROCK UC FOODS: Order #${order.orderCode} is freshly packaged in luxury thermal containers and ready for rider dispatch. Track: ${trackingUrl}`;
      whatsAppText = `📦 *ROCK UC FOODS - Freshly Packaged*\n\nDear *${firstName}*,\n\nYour order *#${order.orderCode}* has finished simmering and has been sealed inside our insulated thermal presentation boxes. Rider handover is underway.\n\n🔗 *Track Rider:* ${trackingUrl}`;
      break;

    case 'out_for_delivery':
      plainText = `ROCK UC FOODS: Your rider is on the way with order #${order.orderCode}! Please keep your phone reachable at ${order.customerPhone}. Track: ${trackingUrl}`;
      whatsAppText = `🚀 *ROCK UC FOODS - Out For Delivery*\n\nGreetings *${firstName}*,\n\nOur dispatched rider is on the road heading to your delivery address with hot, fresh delicacies for order *#${order.orderCode}*!\n\n📍 *Destination:* ${order.deliveryAddress}\n📱 *Customer Line:* ${order.customerPhone}\n\n🔗 *Live Dispatch Map & Tracking:* ${trackingUrl}`;
      break;

    case 'delivered':
      plainText = `ROCK UC FOODS: Order #${order.orderCode} has been delivered! We hope you relish every bite. Thank you for dining with Chef Esther! Receipt: ${trackingUrl}`;
      whatsAppText = `✨ *ROCK UC FOODS - Delivered & Relished*\n\nDearest *${firstName}*,\n\nYour order *#${order.orderCode}* has been delivered! We trust the richness of our aromatic spices and tender cuts brings you pure culinary satisfaction.\n\n*Have feedback or planning a private event?* Reply directly to this chat.\n\n_Warmest regards from Chef Esther & the entire ROCK UC FOODS family._`;
      break;

    default:
      plainText = `ROCK UC FOODS: Update for order #${order.orderCode}. Track: ${trackingUrl}`;
      whatsAppText = `👑 *ROCK UC FOODS Update*\n\nOrder *#${order.orderCode}*\n\n${customNote || 'Thank you for choosing ROCK UC FOODS.'}\n\n🔗 ${trackingUrl}`;
      break;
  }

  if (customNote) {
    plainText += ` Note: ${customNote}`;
    whatsAppText += `\n\n📌 *Special Note:* ${customNote}`;
  }

  const whatsAppUrl = buildWhatsAppUrl(order.customerPhone, whatsAppText);

  return {
    plainText,
    whatsAppText,
    whatsAppUrl,
  };
}

/**
 * Renders templates for catering invoices and receipts.
 */
export function renderCateringTemplate(
  eventType: 'catering_invoice_sent' | 'catering_receipt_sent',
  invoice: Invoice,
  receipt?: Receipt
): RenderedTemplate {
  const clientFirstName = invoice.clientName.split(' ')[0] || invoice.clientName;
  const grandTotalFormatted = formatNaira(invoice.totalKobo);
  const depositFormatted = formatNaira(invoice.depositKobo);
  const balanceFormatted = formatNaira(invoice.balanceKobo);
  const invoiceUrl = `https://rockucfoods.com/invoice/${invoice.id}`;

  let plainText = '';
  let whatsAppText = '';

  if (eventType === 'catering_invoice_sent') {
    plainText = `ROCK UC FOODS: Dear ${clientFirstName}, your catering invoice #${invoice.invoiceNumber} (${grandTotalFormatted}) is ready. Upfront deposit: ${depositFormatted} (70%). Balance: ${balanceFormatted}. Details: ${invoiceUrl}`;
    whatsAppText = `👑 *ROCK UC FOODS - Luxury Event Catering Invoice*\n\nDear *${clientFirstName}*,\n\nWe are delighted to present your official catering invoice *#${invoice.invoiceNumber}*.\n\n💰 *Total Investment:* ${grandTotalFormatted}\n💎 *70% Required Deposit:* ${depositFormatted}\n💳 *30% Delivery Balance:* ${balanceFormatted}\n\n🏦 *Payment Instructions (Moniepoint):*\n• *Account Name:* ROCK UC FOODS\n• *Account Number:* 6625890251\n• *Bank:* Moniepoint MFB\n\n📄 *Download Official PDF Invoice:* ${invoiceUrl}\n\n_Chef Esther & team look forward to hosting an unforgettable event._`;
  } else {
    const amountReceived = receipt ? formatNaira(receipt.amountReceivedKobo) : depositFormatted;
    plainText = `ROCK UC FOODS: Official Receipt for invoice #${invoice.invoiceNumber}. Deposit of ${amountReceived} verified. Your event date is secured! Download: ${invoiceUrl}`;
    whatsAppText = `📜 *ROCK UC FOODS - Official Catering Receipt*\n\nDear *${clientFirstName}*,\n\nYour deposit payment of *${amountReceived}* for invoice *#${invoice.invoiceNumber}* has been verified by the Owner.\n\n✅ *Event Date Secured*\n💳 *Remaining Balance upon Delivery:* ${balanceFormatted}\n\n📄 *View Verified Receipt PDF:* ${invoiceUrl}\n\n_We are preparing our kitchen brigade for your banquet!_`;
  }

  const whatsAppUrl = buildWhatsAppUrl(invoice.clientPhone, whatsAppText);

  return {
    plainText,
    whatsAppText,
    whatsAppUrl,
  };
}
