import { NextRequest, NextResponse } from 'next/server';
import { orderRepository } from '../../../../src/order/orderRepository';

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

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  if (!code) {
    return NextResponse.json({ error: 'Order code is required' }, { status: 400 });
  }

  const order = orderRepository.getByCode(code);
  if (!order) {
    return NextResponse.json({ error: `Order '${code}' not found` }, { status: 404 });
  }

  return NextResponse.json({ order: serializeOrder(order) });
}
