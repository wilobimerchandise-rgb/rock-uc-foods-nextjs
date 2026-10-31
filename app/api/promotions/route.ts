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

function serializePromo(promo: PromoCode) {
  return {
    ...promo,
    discountValue: promo.discountValue.toString(),
    minOrderKobo: promo.minOrderKobo.toString(),
    maxDiscountKobo: promo.maxDiscountKobo !== undefined ? promo.maxDiscountKobo.toString() : null,
  };
}

export async function GET() {
  const promos = promoRepository.getAll();
  return NextResponse.json({
    promos: promos.map(serializePromo),
  });
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
