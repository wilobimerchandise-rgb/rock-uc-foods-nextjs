import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import {
  getEstimatorConfig,
  serializeEstimatorConfig,
  deserializeEstimatorConfig,
} from '@/src/estimator/config';
import { computeEstimate } from '@/src/estimator/compute';
import { updateEstimatorConfig, ConcurrencyError, ValidationError } from '@/src/estimator/editor';
import { formatNaira } from '@/src/lib/money';
import { estimateRepository } from '@/src/invoices/repository';

export async function GET() {
  try {
    const config = getEstimatorConfig();
    return NextResponse.json({
      config: serializeEstimatorConfig(config),
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to retrieve estimator config.' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const config = getEstimatorConfig();

    const { tierId, guestCount, selectedAddOns } = body;

    if (!tierId || typeof guestCount !== 'number') {
      return NextResponse.json(
        { error: 'tierId and numeric guestCount are required.' },
        { status: 400 }
      );
    }

    const result = computeEstimate(
      {
        tierId,
        guestCount,
        selectedAddOns: selectedAddOns || [],
      },
      config
    );

    const estimateId = `est-${crypto.randomUUID()}`;
    const validUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days validity

    estimateRepository.save({
      id: estimateId,
      configVersion: config.version,
      inputs: {
        packageId: tierId,
        guests: guestCount,
        addOnIds: (selectedAddOns || []).map((a: any) => a.addOnId),
      },
      result: {
        foodSubtotalKobo: result.foodSubtotalKobo.toString(),
        addOnsSubtotalKobo: result.addOnsSubtotalKobo.toString(),
        serviceChargeKobo: result.serviceChargeKobo.toString(),
        logisticsKobo: result.logisticsKobo.toString(),
        grandTotalKobo: result.grandTotalKobo.toString(),
        depositKobo: result.depositKobo.toString(),
        balanceKobo: result.balanceKobo.toString(),
      },
      createdAt: new Date().toISOString(),
      validUntil,
    });

    return NextResponse.json({
      estimateId,
      validUntil,
      result: {
        tier: {
          id: result.tier.id,
          name: result.tier.name,
          description: result.tier.description,
          pricePerGuestKobo: result.tier.pricePerGuestKobo.toString(),
          pricePerGuestFormatted: formatNaira(result.tier.pricePerGuestKobo),
        },
        guestCount: result.guestCount,
        foodSubtotalKobo: result.foodSubtotalKobo.toString(),
        foodSubtotalFormatted: formatNaira(result.foodSubtotalKobo),
        addOns: result.addOns.map((a) => ({
          addOnId: a.addOn.id,
          name: a.addOn.name,
          quantity: a.quantity,
          pricingModel: a.addOn.pricingModel,
          totalKobo: a.totalKobo.toString(),
          totalFormatted: formatNaira(a.totalKobo),
        })),
        addOnsSubtotalKobo: result.addOnsSubtotalKobo.toString(),
        addOnsSubtotalFormatted: formatNaira(result.addOnsSubtotalKobo),
        serviceChargeKobo: result.serviceChargeKobo.toString(),
        serviceChargeFormatted: formatNaira(result.serviceChargeKobo),
        logisticsKobo: result.logisticsKobo.toString(),
        logisticsFormatted: formatNaira(result.logisticsKobo),
        grandTotalKobo: result.grandTotalKobo.toString(),
        grandTotalFormatted: formatNaira(result.grandTotalKobo),
        depositKobo: result.depositKobo.toString(),
        depositFormatted: formatNaira(result.depositKobo),
        balanceKobo: result.balanceKobo.toString(),
        balanceFormatted: formatNaira(result.balanceKobo),
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Estimate calculation failed.' },
      { status: 400 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { expectedVersion, updatedBy, tiers, addOns, serviceRates } = body;

    if (typeof expectedVersion !== 'number') {
      return NextResponse.json(
        { error: 'expectedVersion number is required.' },
        { status: 400 }
      );
    }

    // Convert string kobo values to BigInt
    const parsedTiers = (tiers || []).map((t: any) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      pricePerGuestKobo: BigInt(t.pricePerGuestKobo),
      minGuests: Number(t.minGuests),
      maxGuests: Number(t.maxGuests),
      isDefault: Boolean(t.isDefault),
    }));

    const parsedAddOns = (addOns || []).map((a: any) => ({
      id: a.id,
      name: a.name,
      description: a.description,
      unitPriceKobo: BigInt(a.unitPriceKobo),
      pricingModel: a.pricingModel,
      maxQuantity: a.maxQuantity ? Number(a.maxQuantity) : undefined,
    }));

    if (!serviceRates || typeof serviceRates !== 'object') {
      return NextResponse.json(
        { error: 'serviceRates object is required.' },
        { status: 400 }
      );
    }

    const parsedServiceRates = {
      serviceChargeBps: Number(serviceRates.serviceChargeBps || 0),
      baseLogisticsKobo: BigInt(serviceRates.baseLogisticsKobo || '0'),
      minDepositBps: Number(serviceRates.minDepositBps || 0),
    };

    const updated = updateEstimatorConfig(
      expectedVersion,
      updatedBy || 'owner@rockucfoods.com',
      parsedTiers,
      parsedAddOns,
      parsedServiceRates
    );

    return NextResponse.json({
      config: serializeEstimatorConfig(updated),
    });
  } catch (err: any) {
    if (err instanceof ConcurrencyError || err?.name === 'ConcurrencyError') {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    if (err instanceof ValidationError || err?.name === 'ValidationError') {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: err.message || 'Failed to update config.' },
      { status: 500 }
    );
  }
}
