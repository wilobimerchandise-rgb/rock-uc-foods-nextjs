import { NextRequest, NextResponse } from 'next/server';
import { createOrder } from '../../../src/order/orderEngine';
import { orderRepository } from '../../../src/order/orderRepository';
import { CreateOrderInput } from '../../../src/types/order';

function serializeOrder(order: any) {
  return {
    ...order,
    deliveryFeeKobo: order.deliveryFeeKobo.toString(),
    subtotalKobo: order.subtotalKobo.toString(),
    totalKobo: order.totalKobo.toString(),
    discountKobo: order.discountKobo ? order.discountKobo.toString() : undefined,
    items: order.items.map((i: any) => ({
      ...i,
      unitPriceKoboSnapshot: i.unitPriceKoboSnapshot.toString(),
      totalKoboSnapshot: i.totalKoboSnapshot.toString(),
      selectedOptionsSnapshot: (i.selectedOptionsSnapshot || []).map((o: any) => ({
        ...o,
        priceDeltaKobo: o.priceDeltaKobo ? o.priceDeltaKobo.toString() : '0',
      })),
    })),
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const input: CreateOrderInput = {
      customerName: body.customerName,
      customerPhone: body.customerPhone,
      customerEmail: body.customerEmail,
      deliveryType: body.deliveryType,
      deliveryZoneId: body.deliveryZoneId,
      deliveryAddress: body.deliveryAddress,
      specialInstructions: body.specialInstructions,
      acceptedPolicy: body.acceptedPolicy,
      policyVersion: body.policyVersion,
      items: body.items || [],
      promoCodeId: body.promoCodeId,
      discountKobo: body.discountKobo ? BigInt(body.discountKobo) : undefined,
    };

    const order = createOrder(input);

    return NextResponse.json({
      success: true,
      order: serializeOrder(order),
      orderCode: order.orderCode,
      trackingUrl: `/order/${order.orderCode}`,
    }, { status: 201 });
  } catch (err: any) {
    const message = err?.message || 'Failed to place order.';
    return NextResponse.json(
      { success: false, error: message },
      { status: 400 }
    );
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');

  if (code) {
    const order = orderRepository.getByCode(code);
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }
    return NextResponse.json({ order: serializeOrder(order) });
  }

  const all = orderRepository.getAll();
  return NextResponse.json({ orders: all.map(serializeOrder) });
}
