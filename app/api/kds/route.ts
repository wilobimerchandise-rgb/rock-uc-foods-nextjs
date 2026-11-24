/**
 * ROCK UC FOODS - Kitchen Display System (KDS) API
 * Playbook v2 Section 13 / Phase 4 KDS
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  kitchenTicketRepository,
  createKitchenTicketForOrder,
  startCooking,
  markPlated,
  markHandedOff,
} from '@/src/dispatch/dispatchEngine';
import { orderRepository } from '@/src/order/orderRepository';
import { sendOrderNotification } from '@/src/notifications/notificationEngine';
import { isSameOrigin } from '@/src/lib/same-origin';
import { resolveActiveAdminProfile } from '@/src/order/orderAuth';
import { requireRole, AuthorizationError } from '@/src/lib/auth/access';

export const dynamic = 'force-dynamic';

function serializeTicket(ticket: any) {
  if (!ticket) return null;
  return {
    ...ticket,
    items: (ticket.items || []).map((i: any) => ({
      ...i,
      unitPriceKoboSnapshot: i.unitPriceKoboSnapshot?.toString(),
      totalKoboSnapshot: i.totalKoboSnapshot?.toString(),
      selectedOptionsSnapshot: (i.selectedOptionsSnapshot || []).map((o: any) => ({
        ...o,
        priceDeltaKobo: o.priceDeltaKobo ? o.priceDeltaKobo.toString() : '0',
      })),
    })),
  };
}

export async function GET(req: NextRequest) {
  const adminRes = await resolveActiveAdminProfile(req);
  if ('error' in adminRes) {
    return NextResponse.json(
      { error: adminRes.error },
      { status: adminRes.status, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  try {
    requireRole(
      ['owner', 'staff', 'developer'],
      adminRes.userProfile,
      'view kitchen display tickets',
      'kds_tickets'
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

  const { searchParams } = new URL(req.url);
  const orderId = searchParams.get('orderId');
  const station = searchParams.get('station');

  let tickets = kitchenTicketRepository.getAll();

  if (orderId) {
    tickets = tickets.filter((t) => t.orderId === orderId);
  }

  if (station && station !== 'all') {
    tickets = tickets.filter((t) => t.assignedStation === station);
  }

  // Sort: urgent first, then oldest created
  const priorityWeight: Record<string, number> = { urgent: 4, high: 3, normal: 2, low: 1 };
  tickets.sort((a, b) => {
    const diff = (priorityWeight[b.priority] || 0) - (priorityWeight[a.priority] || 0);
    if (diff !== 0) return diff;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });

  return NextResponse.json(
    { tickets: tickets.map(serializeTicket) },
    { status: 200, headers: { 'Cache-Control': 'no-store' } }
  );
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
    requireRole(
      ['owner', 'staff', 'developer'],
      adminRes.userProfile,
      'update kitchen display tickets',
      'kds_tickets'
    );

    const body = await req.json();
    const { action, orderId, ticketId, priority = 'normal' } = body;

    if (action === 'create_ticket') {
      if (!orderId) {
        return NextResponse.json(
          { error: 'orderId is required to create a ticket.' },
          { status: 400, headers: { 'Cache-Control': 'no-store' } }
        );
      }

      const ticket = createKitchenTicketForOrder(orderId, priority);
      return NextResponse.json(
        { success: true, ticket: serializeTicket(ticket) },
        { status: 200, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    if (action === 'start_cooking') {
      if (!ticketId) {
        return NextResponse.json(
          { error: 'ticketId is required.' },
          { status: 400, headers: { 'Cache-Control': 'no-store' } }
        );
      }

      const ticket = startCooking(ticketId);
      const order = orderRepository.getById(ticket.orderId);
      if (order) {
        try {
          sendOrderNotification(order, 'in_kitchen', 'whatsapp');
        } catch {
          // Non-blocking notification dispatch
        }
      }
      return NextResponse.json(
        { success: true, ticket: serializeTicket(ticket) },
        { status: 200, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    if (action === 'mark_plated') {
      if (!ticketId) {
        return NextResponse.json(
          { error: 'ticketId is required.' },
          { status: 400, headers: { 'Cache-Control': 'no-store' } }
        );
      }

      const ticket = markPlated(ticketId);
      return NextResponse.json(
        { success: true, ticket: serializeTicket(ticket) },
        { status: 200, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    if (action === 'mark_handed_off') {
      if (!ticketId) {
        return NextResponse.json(
          { error: 'ticketId is required.' },
          { status: 400, headers: { 'Cache-Control': 'no-store' } }
        );
      }

      const ticket = markHandedOff(ticketId);
      const order = orderRepository.getById(ticket.orderId);
      if (order && order.status === 'ready_for_dispatch') {
        try {
          sendOrderNotification(order, 'ready_for_dispatch', 'whatsapp');
        } catch {
          // Non-blocking notification dispatch
        }
      }
      return NextResponse.json(
        { success: true, ticket: serializeTicket(ticket) },
        { status: 200, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    return NextResponse.json(
      { error: `Unknown action: '${action}'` },
      { status: 400, headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err: any) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json(
        { error: err.message },
        { status: 403, headers: { 'Cache-Control': 'no-store' } }
      );
    }
    return NextResponse.json(
      { error: err.message || 'KDS action failed.' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
