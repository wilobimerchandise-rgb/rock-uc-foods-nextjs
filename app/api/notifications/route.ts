/**
 * ROCK UC FOODS - Notification Dispatch & History API
 * Playbook v4 Section 25
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  notificationRepository,
  sendOrderNotification,
} from '@/src/notifications/notificationEngine';
import { orderRepository } from '@/src/order/orderRepository';
import { NotificationEventType, NotificationChannel } from '@/src/types/notification';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const orderId = searchParams.get('orderId');

  if (orderId) {
    const notifications = notificationRepository.getNotificationsForOrder(orderId);
    return NextResponse.json({ notifications });
  }

  const notifications = notificationRepository.getAllNotifications();
  return NextResponse.json({ notifications });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { orderId, eventType, channel = 'whatsapp', customNote } = body;

    if (!orderId || !eventType) {
      return NextResponse.json(
        { error: 'orderId and eventType are required.' },
        { status: 400 }
      );
    }

    const order = orderRepository.getById(orderId);
    if (!order) {
      return NextResponse.json(
        { error: `Order '${orderId}' not found.` },
        { status: 404 }
      );
    }

    const notification = sendOrderNotification(
      order,
      eventType as NotificationEventType,
      channel as NotificationChannel,
      customNote
    );

    return NextResponse.json({
      success: true,
      notification,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to dispatch notification.' },
      { status: 500 }
    );
  }
}
