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
import {
  NotificationEventType,
  NotificationChannel,
  NotificationMessage,
} from '@/src/types/notification';
import { isSameOrigin } from '@/src/lib/same-origin';
import { resolveActiveAdminProfile, authorizeOrderAccess } from '@/src/order/orderAuth';
import { requireRole, AuthorizationError } from '@/src/lib/auth/access';
import { maskCustomerPhone } from '@/src/lib/security';

export const dynamic = 'force-dynamic';

function serializeNotificationForAdmin(
  n: NotificationMessage,
  role?: string | null,
  hasMfaVerified?: boolean
): NotificationMessage {
  return {
    ...n,
    recipientPhone: maskCustomerPhone(n.recipientPhone, role, hasMfaVerified),
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const orderId = searchParams.get('orderId')?.trim();

  const adminRes = await resolveActiveAdminProfile(req);

  if (orderId) {
    // Path A: Active Admin inspecting notifications for an order
    if ('userProfile' in adminRes) {
      try {
        const actor = requireRole(
          ['owner', 'staff', 'developer'],
          adminRes.userProfile,
          'view order notifications',
          orderId
        );
        const notifications = notificationRepository
          .getNotificationsForOrder(orderId)
          .map((n) => serializeNotificationForAdmin(n, actor.role, actor.hasMfaVerified));

        return NextResponse.json(
          { notifications },
          { status: 200, headers: { 'Cache-Control': 'no-store' } }
        );
      } catch (err: any) {
        if (err instanceof AuthorizationError) {
          return NextResponse.json(
            { error: err.message },
            { status: 403, headers: { 'Cache-Control': 'no-store' } }
          );
        }
        throw err;
      }
    }

    // Path B: Customer viewing own order tracking notifications via order token / cookie
    const order = orderRepository.getById(orderId);
    if (!order) {
      const hasToken =
        Boolean(req.headers.get('x-order-token')?.trim()) ||
        Boolean(searchParams.get('token')?.trim());
      return NextResponse.json(
        {
          error: hasToken
            ? 'Forbidden: You do not have permission to access notifications for this order.'
            : 'Order verification token or admin sign-in is required to view notifications.',
        },
        { status: hasToken ? 403 : 401, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const access = await authorizeOrderAccess(req, order.orderCode);
    if (!access.authorized) {
      return NextResponse.json(
        { error: access.error },
        { status: access.status, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const notifications = notificationRepository.getNotificationsForOrder(order.id);
    return NextResponse.json(
      { notifications },
      { status: 200, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  // Unscoped outbox list is strictly admin-only
  if ('error' in adminRes) {
    return NextResponse.json(
      { error: adminRes.error },
      { status: adminRes.status, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  try {
    const actor = requireRole(
      ['owner', 'staff', 'developer'],
      adminRes.userProfile,
      'view notification outbox',
      'notifications'
    );
    const notifications = notificationRepository
      .getAllNotifications()
      .map((n) => serializeNotificationForAdmin(n, actor.role, actor.hasMfaVerified));

    return NextResponse.json(
      { notifications },
      { status: 200, headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err: any) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json(
        { error: err.message },
        { status: 403, headers: { 'Cache-Control': 'no-store' } }
      );
    }
    throw err;
  }
}

export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) {
    return NextResponse.json(
      { error: 'Cross-origin or missing origin requests are forbidden.' },
      { status: 403, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const adminRes = await resolveActiveAdminProfile(req);
  if ('error' in adminRes) {
    return NextResponse.json(
      { error: adminRes.error },
      { status: adminRes.status, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  try {
    const actor = requireRole(
      ['owner', 'staff', 'developer'],
      adminRes.userProfile,
      'dispatch order notification',
      'notifications'
    );

    const body = await req.json();
    const { orderId, eventType, channel = 'whatsapp', customNote } = body;

    if (!orderId || !eventType) {
      return NextResponse.json(
        { error: 'orderId and eventType are required.' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const order = orderRepository.getById(orderId);
    if (!order) {
      return NextResponse.json(
        { error: `Order '${orderId}' not found.` },
        { status: 404, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const notification = sendOrderNotification(
      order,
      eventType as NotificationEventType,
      channel as NotificationChannel,
      customNote
    );

    return NextResponse.json(
      {
        success: true,
        notification: serializeNotificationForAdmin(
          notification,
          actor.role,
          actor.hasMfaVerified
        ),
      },
      { status: 200, headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err: any) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json(
        { error: err.message },
        { status: 403, headers: { 'Cache-Control': 'no-store' } }
      );
    }
    return NextResponse.json(
      { error: err.message || 'Failed to dispatch notification.' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
