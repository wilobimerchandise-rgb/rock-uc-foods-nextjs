/**
 * ROCK UC FOODS - Sales Reporting & CSV Export API
 * Playbook v2 Section 12 (Phase 7: Reports, Promotions and Exports)
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  generateSalesReport,
  exportOrdersToCsv,
  parseReportDateBoundMs,
} from '@/src/promotions/promotionEngine';
import { orderRepository } from '@/src/order/orderRepository';
import { resolveActiveAdminProfile } from '@/src/order/orderAuth';
import { requireRole, AuthorizationError } from '@/src/lib/auth/access';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const authRes = await resolveActiveAdminProfile(req);
  if ('status' in authRes) {
    return NextResponse.json(
      { error: authRes.error },
      { status: authRes.status, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  try {
    requireRole(['owner', 'staff', 'developer'], authRes.userProfile, 'view sales report');
  } catch (err: unknown) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json(
        { error: err.message },
        { status: 403, headers: { 'Cache-Control': 'no-store' } }
      );
    }
    throw err;
  }

  const { searchParams } = new URL(req.url);
  const startDate = searchParams.get('startDate') || undefined;
  const endDate = searchParams.get('endDate') || undefined;
  const format = searchParams.get('format') || 'json';

  const qualifyingStatuses = [
    'paid',
    'payment_confirmed',
    'in_kitchen',
    'ready_for_dispatch',
    'out_for_delivery',
    'delivered',
  ];

  const allOrders = orderRepository.getAll();
  const startMs = parseReportDateBoundMs(startDate, 'start');
  const endMs = parseReportDateBoundMs(endDate, 'end');

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
        'Cache-Control': 'no-store',
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

  return NextResponse.json(
    { report: serializedReport },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
