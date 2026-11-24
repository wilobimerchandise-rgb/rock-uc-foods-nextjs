/**
 * ROCK UC FOODS - Admin Lagos Delivery Zones Pricing & Active Settings API
 * BigInt kobo strictly enforced via parseNairaToKobo; owner + verified MFA required for writes.
 */

import { NextRequest, NextResponse } from 'next/server';
import { isSameOrigin } from '../../../../src/lib/same-origin';
import { resolveActiveAdminProfile } from '../../../../src/order/orderAuth';
import { requireRole, AuthorizationError } from '../../../../src/lib/auth/access';
import {
  getAllDeliveryZones,
  updateDeliveryZone,
} from '../../../../src/order/deliveryZones';
import { formatNaira, parseNairaToKobo } from '../../../../src/lib/money';
import { DeliveryZone } from '../../../../src/types/order';

export const dynamic = 'force-dynamic';

function serializeZone(zone: DeliveryZone) {
  return {
    id: zone.id,
    code: zone.code,
    name: zone.name,
    areas: zone.areas,
    feeKobo: zone.feeKobo.toString(),
    feeFormatted: formatNaira(zone.feeKobo),
    isActive: zone.isActive,
    sortOrder: zone.sortOrder,
  };
}

export async function GET(request: NextRequest) {
  const adminCheck = await resolveActiveAdminProfile(request);
  if ('error' in adminCheck) {
    return NextResponse.json(
      { error: adminCheck.error },
      { status: adminCheck.status, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const zones = getAllDeliveryZones(true);
  return NextResponse.json(
    { zones: zones.map(serializeZone) },
    {
      status: 200,
      headers: {
        'Cache-Control': 'no-store',
        'X-Robots-Tag': 'noindex',
      },
    }
  );
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return NextResponse.json(
      { error: 'Cross-origin or missing origin requests are forbidden.' },
      { status: 403, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const adminCheck = await resolveActiveAdminProfile(request);
  if ('error' in adminCheck) {
    return NextResponse.json(
      { error: adminCheck.error },
      { status: adminCheck.status, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  try {
    requireRole(['owner'], adminCheck.userProfile, 'update Lagos delivery zone settings', 'delivery_zones', {
      requireSecondFactor: true,
    });

    const body = await request.json();
    const id = typeof body?.id === 'string' ? body.id.trim() : '';
    if (!id) {
      return NextResponse.json(
        { error: 'Delivery zone id is required.' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    let feeKobo: bigint | undefined;
    if (body.feeNaira !== undefined && body.feeNaira !== null && String(body.feeNaira).trim() !== '') {
      feeKobo = parseNairaToKobo(String(body.feeNaira));
    }

    const isActive = typeof body.isActive === 'boolean' ? body.isActive : undefined;
    const name = typeof body.name === 'string' ? body.name : undefined;
    const areas = Array.isArray(body.areas)
      ? body.areas.map((a: unknown) => String(a))
      : typeof body.areasCsv === 'string'
      ? body.areasCsv.split(',').map((s: string) => s.trim()).filter(Boolean)
      : undefined;

    const updated = updateDeliveryZone({
      id,
      feeKobo,
      isActive,
      name,
      areas,
      actorId: adminCheck.userProfile.id,
      actorRole: adminCheck.userProfile.role,
    });

    return NextResponse.json(
      {
        success: true,
        zone: serializeZone(updated),
        zones: getAllDeliveryZones(true).map(serializeZone),
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store',
          'X-Robots-Tag': 'noindex',
        },
      }
    );
  } catch (err: any) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json(
        { error: err.message },
        { status: 403, headers: { 'Cache-Control': 'no-store' } }
      );
    }
    return NextResponse.json(
      { error: err?.message || 'Failed to update delivery zone.' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
