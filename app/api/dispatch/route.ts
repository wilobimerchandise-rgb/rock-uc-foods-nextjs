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
import { isSameOrigin } from '@/src/lib/same-origin';
import { resolveActiveAdminProfile, serializeOrderForApi } from '@/src/order/orderAuth';
import { requireRole, AuthorizationError } from '@/src/lib/auth/access';

export const dynamic = 'force-dynamic';

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
      'view dispatch assignments',
      'dispatch_assignments'
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

  if (orderId) {
    const assignment = dispatchRepository.getByOrderId(orderId);
    return NextResponse.json(
      { assignment },
      { status: 200, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const assignments = dispatchRepository.getAll();
  return NextResponse.json(
    { assignments },
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
    const actor = requireRole(
      ['owner', 'staff', 'developer'],
      adminRes.userProfile,
      'manage dispatch assignments',
      'dispatch_assignments'
    );

    const body = await req.json();
    const { action, orderId, riderName, riderPhone, riderVehiclePlate, customerSignatureConfirmed } = body;

    if (action === 'assign_rider') {
      if (!orderId || !riderName || !riderPhone) {
        return NextResponse.json(
          { error: 'orderId, riderName, and riderPhone are required.' },
          { status: 400, headers: { 'Cache-Control': 'no-store' } }
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

      return NextResponse.json(
        { success: true, assignment },
        { status: 200, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    if (action === 'confirm_delivery') {
      if (!orderId) {
        return NextResponse.json(
          { error: 'orderId is required.' },
          { status: 400, headers: { 'Cache-Control': 'no-store' } }
        );
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

      return NextResponse.json(
        {
          success: true,
          assignment,
          order: order
            ? serializeOrderForApi(order, {
                isAdmin: true,
                role: actor.role,
                hasMfaVerified: actor.hasMfaVerified,
              })
            : null,
        },
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
      { error: err.message || 'Dispatch action failed.' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
