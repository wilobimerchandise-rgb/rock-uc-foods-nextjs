/**
 * ROCK UC FOODS - Promotions & Coupon API
 * Playbook v2 Section 12 (Phase 7: Reports, Promotions and Exports)
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  promoRepository,
  validateAndCalculatePromo,
} from '@/src/promotions/promotionEngine';
import { PromoCode } from '@/src/types/promotion';
import { resolveActiveAdminProfile } from '@/src/order/orderAuth';
import { requireRole, AuthorizationError } from '@/src/lib/auth/access';

export const dynamic = 'force-dynamic';

function serializePromo(promo: PromoCode) {
  return {
    ...promo,
    discountValue: promo.discountValue.toString(),
    minOrderKobo: promo.minOrderKobo.toString(),
    maxDiscountKobo: promo.maxDiscountKobo !== undefined ? promo.maxDiscountKobo.toString() : null,
  };
}

async function authorizePromoAdmin(req: NextRequest): Promise<NextResponse | null> {
  const authRes = await resolveActiveAdminProfile(req);
  if ('status' in authRes) {
    return NextResponse.json(
      { error: authRes.error },
      { status: authRes.status, headers: { 'Cache-Control': 'no-store' } }
    );
  }
  try {
    requireRole(['owner', 'staff', 'developer'], authRes.userProfile, 'manage promotions');
  } catch (err: unknown) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json(
        { error: err.message },
        { status: 403, headers: { 'Cache-Control': 'no-store' } }
      );
    }
    throw err;
  }
  return null;
}

export async function GET(req: NextRequest) {
  const denied = await authorizePromoAdmin(req);
  if (denied) return denied;

  const promos = promoRepository.getAll();
  return NextResponse.json(
    { promos: promos.map(serializePromo) },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    if (action === 'validate') {
      const { code, subtotalKobo } = body;
      if (!code || typeof code !== 'string') {
        return NextResponse.json({ error: 'Promo code is required.' }, { status: 400 });
      }

      const subtotalBigInt = BigInt(subtotalKobo || 0);
      const result = validateAndCalculatePromo(code, subtotalBigInt);

      return NextResponse.json({
        isValid: result.isValid,
        discountKobo: result.discountKobo.toString(),
        promoCode: result.promoCode ? serializePromo(result.promoCode) : undefined,
        reason: result.reason,
      });
    }

    if (action === 'create') {
      const denied = await authorizePromoAdmin(req);
      if (denied) return denied;

      const {
        code,
        description,
        discountType,
        discountValue,
        minOrderKobo = '0',
        maxDiscountKobo,
        usageLimit,
        startDate,
        endDate,
        isActive = true,
      } = body;

      if (!code || !discountType || discountValue === undefined || !endDate) {
        return NextResponse.json(
          { error: 'code, discountType, discountValue, and endDate are required.' },
          { status: 400 }
        );
      }

      const newPromo: PromoCode = {
        id: `promo-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        code: String(code).trim().toUpperCase(),
        description: description ? String(description).trim() : undefined,
        discountType: discountType as 'percentage' | 'fixed_amount',
        discountValue: BigInt(discountValue),
        minOrderKobo: BigInt(minOrderKobo),
        maxDiscountKobo: maxDiscountKobo ? BigInt(maxDiscountKobo) : undefined,
        usageLimit: usageLimit ? Number(usageLimit) : undefined,
        usedCount: 0,
        startDate: startDate || new Date().toISOString(),
        endDate: String(endDate),
        isActive: Boolean(isActive),
        createdAt: new Date().toISOString(),
      };

      const saved = promoRepository.save(newPromo);
      return NextResponse.json({
        success: true,
        promo: serializePromo(saved),
      });
    }

    if (action === 'toggle') {
      const denied = await authorizePromoAdmin(req);
      if (denied) return denied;

      const { id } = body;
      if (!id) {
        return NextResponse.json({ error: 'Promo id is required.' }, { status: 400 });
      }

      const promo = promoRepository.getById(id);
      if (!promo) {
        return NextResponse.json({ error: `Promo '${id}' not found.` }, { status: 404 });
      }

      promo.isActive = !promo.isActive;
      promoRepository.save(promo);

      return NextResponse.json({
        success: true,
        promo: serializePromo(promo),
      });
    }

    return NextResponse.json({ error: `Unknown action: '${action}'` }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Promotion action failed.' }, { status: 400 });
  }
}
