/**
 * ROCK UC FOODS - Dispatch & Rider Assignment API
 * Playbook v2 Section 13 / Phase 4 Dispatch
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  dispatchRepository,
  assignRiderToOrder,
  confirmDelivery,
} from '@/src/dispatch/dispatchEngine';
import { orderRepository } from '@/src/order/orderRepository';
import { normalizeNigerianPhone } from '@/src/notifications/phone';
import { sendOrderNotification } from '@/src/notifications/notificationEngine';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const orderId = searchParams.get('orderId');

  if (orderId) {
    const assignment = dispatchRepository.getByOrderId(orderId);
    return NextResponse.json({ assignment });
  }

  const assignments = dispatchRepository.getAll();
  return NextResponse.json({ assignments });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, orderId, riderName, riderPhone, riderVehiclePlate, customerSignatureConfirmed } = body;

    if (action === 'assign_rider') {
      if (!orderId || !riderName || !riderPhone) {
        return NextResponse.json(
          { error: 'orderId, riderName, and riderPhone are required.' },
          { status: 400 }
        );
      }

      // Auto-normalize Nigerian phone if entered in local format (080...)
      const norm = normalizeNigerianPhone(riderPhone);
      const formattedPhone = norm.valid ? norm.e164 : riderPhone.trim();

      const assignment = assignRiderToOrder({
        orderId,
        riderName,
        riderPhone: formattedPhone,
        riderVehiclePlate,
      });

      const order = orderRepository.getById(orderId);
      if (order) {
        try {
          sendOrderNotification(
            order,
            'out_for_delivery',
            'whatsapp',
            `Assigned Rider: ${riderName} (${formattedPhone})${riderVehiclePlate ? ` | Plate: ${riderVehiclePlate}` : ''}`
          );
        } catch {
          // Non-blocking notification dispatch
        }
      }

      return NextResponse.json({ success: true, assignment });
    }

    if (action === 'confirm_delivery') {
      if (!orderId) {
        return NextResponse.json({ error: 'orderId is required.' }, { status: 400 });
      }

      const assignment = confirmDelivery({
        orderId,
        customerSignatureConfirmed: !!customerSignatureConfirmed,
      });

      const order = orderRepository.getById(orderId);
      if (order) {
        try {
          sendOrderNotification(order, 'delivered', 'whatsapp');
        } catch {
          // Non-blocking notification dispatch
        }
      }

      return NextResponse.json({
        success: true,
        assignment,
        order,
      });
    }

    return NextResponse.json({ error: `Unknown action: '${action}'` }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Dispatch action failed.' }, { status: 400 });
  }
}
