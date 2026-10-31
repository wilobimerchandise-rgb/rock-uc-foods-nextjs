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

export async function GET(req: NextRequest) {
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

  return NextResponse.json({ tickets });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, orderId, ticketId, priority = 'normal' } = body;

    if (action === 'create_ticket') {
      if (!orderId) {
        return NextResponse.json({ error: 'orderId is required to create a ticket.' }, { status: 400 });
      }

      const ticket = createKitchenTicketForOrder(orderId, priority);
      return NextResponse.json({ success: true, ticket });
    }

    if (action === 'start_cooking') {
      if (!ticketId) {
        return NextResponse.json({ error: 'ticketId is required.' }, { status: 400 });
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
      return NextResponse.json({ success: true, ticket });
    }

    if (action === 'mark_plated') {
      if (!ticketId) {
        return NextResponse.json({ error: 'ticketId is required.' }, { status: 400 });
      }

      const ticket = markPlated(ticketId);
      return NextResponse.json({ success: true, ticket });
    }

    if (action === 'mark_handed_off') {
      if (!ticketId) {
        return NextResponse.json({ error: 'ticketId is required.' }, { status: 400 });
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
      return NextResponse.json({ success: true, ticket });
    }

    return NextResponse.json({ error: `Unknown action: '${action}'` }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'KDS action failed.' }, { status: 400 });
  }
}
