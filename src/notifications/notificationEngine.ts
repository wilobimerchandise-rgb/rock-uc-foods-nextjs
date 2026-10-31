/**
 * ROCK UC FOODS - Notification Outbox & Dispatch Engine
 * Playbook v4 Section 25
 */

import {
  NotificationMessage,
  NotificationEventType,
  NotificationChannel,
} from '../types/notification';
import { Order } from '../types/order';
import { Invoice, Receipt } from '../types/invoice';
import { renderOrderTemplate, renderCateringTemplate } from './templates';
import { normalizeNigerianPhone } from './phone';

class NotificationRepository {
  private outbox: Map<string, NotificationMessage> = new Map();

  clear() {
    this.outbox.clear();
  }

  saveNotification(message: NotificationMessage): NotificationMessage {
    this.outbox.set(message.id, { ...message });
    return message;
  }

  getNotificationById(id: string): NotificationMessage | undefined {
    return this.outbox.get(id);
  }

  getNotificationsForOrder(orderId: string): NotificationMessage[] {
    return Array.from(this.outbox.values())
      .filter((m) => m.orderId === orderId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  getNotificationsForInvoice(invoiceId: string): NotificationMessage[] {
    return Array.from(this.outbox.values())
      .filter((m) => m.invoiceId === invoiceId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  getAllNotifications(): NotificationMessage[] {
    return Array.from(this.outbox.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }
}

export const notificationRepository = new NotificationRepository();

/**
 * Dispatches an automated notification for an order lifecycle transition.
 */
export function sendOrderNotification(
  order: Order,
  eventType: NotificationEventType,
  channel: NotificationChannel = 'whatsapp',
  customNote?: string
): NotificationMessage {
  const phoneCheck = normalizeNigerianPhone(order.customerPhone);
  const recipientPhone = phoneCheck.valid ? phoneCheck.e164 : order.customerPhone;

  const rendered = renderOrderTemplate(eventType, order, customNote);
  const messageBody = channel === 'sms' ? rendered.plainText : rendered.whatsAppText;

  const nowIso = new Date().toISOString();
  const notificationId = `notif-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  const notification: NotificationMessage = {
    id: notificationId,
    recipientPhone,
    recipientName: order.customerName,
    orderId: order.id,
    orderCode: order.orderCode,
    eventType,
    channel,
    message: messageBody,
    whatsAppUrl: rendered.whatsAppUrl,
    status: 'sent', // Outbox dispatches automatically
    providerRef: `prov-${channel}-${Date.now()}`,
    createdAt: nowIso,
    sentAt: nowIso,
  };

  notificationRepository.saveNotification(notification);
  return notification;
}

/**
 * Dispatches a notification for a catering invoice or receipt.
 */
export function sendCateringNotification(
  invoice: Invoice,
  eventType: 'catering_invoice_sent' | 'catering_receipt_sent',
  receipt?: Receipt,
  channel: NotificationChannel = 'whatsapp'
): NotificationMessage {
  const phoneCheck = normalizeNigerianPhone(invoice.clientPhone);
  const recipientPhone = phoneCheck.valid ? phoneCheck.e164 : invoice.clientPhone;

  const rendered = renderCateringTemplate(eventType, invoice, receipt);
  const messageBody = channel === 'sms' ? rendered.plainText : rendered.whatsAppText;

  const nowIso = new Date().toISOString();
  const notificationId = `notif-cat-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  const notification: NotificationMessage = {
    id: notificationId,
    recipientPhone,
    recipientName: invoice.clientName,
    invoiceId: invoice.id,
    eventType,
    channel,
    message: messageBody,
    whatsAppUrl: rendered.whatsAppUrl,
    status: 'sent',
    providerRef: `prov-${channel}-${Date.now()}`,
    createdAt: nowIso,
    sentAt: nowIso,
  };

  notificationRepository.saveNotification(notification);
  return notification;
}
