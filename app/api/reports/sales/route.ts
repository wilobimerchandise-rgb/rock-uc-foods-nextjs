/**
 * ROCK UC FOODS - Sales Reporting & CSV Export API
 * Playbook v2 Section 12 (Phase 7: Reports, Promotions and Exports)
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  generateSalesReport,
  exportOrdersToCsv,
} from '@/src/promotions/promotionEngine';
import { orderRepository } from '@/src/order/orderRepository';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const startDate = searchParams.get('startDate') || undefined;
  const endDate = searchParams.get('endDate') || undefined;
  const format = searchParams.get('format') || 'json';

  const qualifyingStatuses = [
    'payment_confirmed',
    'in_kitchen',
    'ready_for_dispatch',
    'out_for_delivery',
    'delivered',
  ];

  const allOrders = orderRepository.getAll();
  const startMs = startDate ? new Date(startDate).getTime() : 0;
  const endMs = endDate ? new Date(endDate).getTime() : Number.MAX_SAFE_INTEGER;

  const filteredOrders = allOrders.filter((ord) => {
    const orderMs = new Date(ord.createdAt).getTime();
    return orderMs >= startMs && orderMs <= endMs && qualifyingStatuses.includes(ord.status);
  });

  if (format === 'csv') {
    const csvContent = exportOrdersToCsv(filteredOrders);
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="rock-uc-foods-sales-report-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });
  }

  const report = generateSalesReport(startDate, endDate);

  // Serialize BigInt values
  const serializedReport = {
    ...report,
    grossRevenueKobo: report.grossRevenueKobo.toString(),
    totalDiscountsKobo: report.totalDiscountsKobo.toString(),
    totalDeliveryFeesKobo: report.totalDeliveryFeesKobo.toString(),
    netRevenueKobo: report.netRevenueKobo.toString(),
    averageOrderValueKobo: report.averageOrderValueKobo.toString(),
    zoneBreakdown: Object.fromEntries(
      Object.entries(report.zoneBreakdown).map(([zoneId, data]) => [
        zoneId,
        {
          ...data,
          revenueKobo: data.revenueKobo.toString(),
        },
      ])
    ),
    itemPopularity: report.itemPopularity.map((item) => ({
      ...item,
      revenueKobo: item.revenueKobo.toString(),
    })),
  };

  return NextResponse.json({ report: serializedReport });
}
