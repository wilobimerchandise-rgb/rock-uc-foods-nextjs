/**
 * ROCK UC FOODS - Automated Customer Notifications & Alerts Types
 * Playbook v4 Section 25
 */

export type NotificationChannel = 'whatsapp' | 'sms' | 'in_app';

export type NotificationEventType =
  | 'order_confirmed'
  | 'in_kitchen'
  | 'ready_for_dispatch'
  | 'out_for_delivery'
  | 'delivered'
  | 'catering_invoice_sent'
  | 'catering_receipt_sent';

export type NotificationStatus = 'pending' | 'sent' | 'failed';

export interface NotificationMessage {
  id: string;
  recipientPhone: string;
  recipientName: string;
  orderId?: string;
  orderCode?: string;
  invoiceId?: string;
  eventType: NotificationEventType;
  channel: NotificationChannel;
  message: string;
  whatsAppUrl?: string;
  status: NotificationStatus;
  providerRef?: string;
  errorMessage?: string;
  createdAt: string;
  sentAt?: string;
}

export interface SendNotificationInput {
  orderId?: string;
  invoiceId?: string;
  recipientPhone: string;
  recipientName: string;
  eventType: NotificationEventType;
  channel?: NotificationChannel;
  customNote?: string;
}
