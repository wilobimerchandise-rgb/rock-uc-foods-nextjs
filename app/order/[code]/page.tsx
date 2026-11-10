'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { formatMoneyKobo } from '../../../src/lib/money';
import { BUSINESS_CONTACT, ALLERGEN_NOTICE } from '../../../src/policy/content';
import {
  CheckCircle2,
  Clock,
  MessageCircle,
  Truck,
  Store,
  ArrowLeft,
  AlertCircle,
  Printer,
  ShoppingBag,
} from 'lucide-react';

interface OrderItemView {
  id: string;
  nameSnapshot: string;
  portionSnapshot?: string;
  selectedTierName?: string;
  selectedOptionsSnapshot?: Array<{ id: string; name: string; priceDeltaKobo: string }>;
  unitPriceKoboSnapshot: string;
  quantity: number;
  totalKoboSnapshot: string;
}

interface OrderView {
  id: string;
  orderCode: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  deliveryType: 'delivery' | 'collection';
  deliveryZoneId?: string;
  deliveryAddress?: string;
  deliveryFeeKobo: string;
  subtotalKobo: string;
  totalKobo: string;
  status: string;
  specialInstructions?: string;
  policyVersion: string;
  policyAcceptedAt: string;
  expiresAt: string;
  createdAt: string;
  items: OrderItemView[];
}

export default function OrderTrackingPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const resolvedParams = use(params);
  const code = resolvedParams.code;

  const [order, setOrder] = useState<OrderView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    let isMounted = true;

    async function fetchOrder() {
      try {
        const res = await fetch(`/api/orders/${encodeURIComponent(code)}`);
        const data = await res.json();
        if (!res.ok || !data.order) {
          throw new Error(data.error || 'Order not found');
        }
        if (isMounted) {
          setOrder(data.order);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || 'Could not load order');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    fetchOrder();

    return () => {
      isMounted = false;
    };
  }, [code]);

  // 15-minute countdown interval
  useEffect(() => {
    if (!order || order.status !== 'pending_payment') {
      return;
    }

    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, [order]);

  const timeLeftSeconds =
    order && order.status === 'pending_payment'
      ? Math.max(0, Math.floor((new Date(order.expiresAt).getTime() - now) / 1000))
      : null;

  const formatCountdown = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'payment_confirmed':
        return { label: 'Payment Confirmed', color: 'bg-emerald-950 text-emerald-400 border-emerald-800' };
      case 'in_kitchen':
        return { label: 'Cooking in Kitchen', color: 'bg-amber-950 text-amber-300 border-amber-800' };
      case 'ready_for_dispatch':
        return { label: 'Ready for Dispatch', color: 'bg-blue-950 text-blue-300 border-blue-800' };
      case 'out_for_delivery':
        return { label: 'Out for Delivery', color: 'bg-purple-950 text-purple-300 border-purple-800' };
      case 'delivered':
        return { label: 'Delivered Fresh', color: 'bg-green-950 text-green-300 border-green-800' };
      case 'cancelled':
        return { label: 'Cancelled / Expired', color: 'bg-red-950 text-red-400 border-red-800' };
      default:
        return { label: 'Awaiting Payment', color: 'bg-[#6B1230] text-[#F7EFD9] border-[#D4AF37]/40' };
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B0A09] text-[#F7EFD9] flex flex-col items-center justify-center p-6 space-y-3">
        <div className="w-10 h-10 border-2 border-[#D4AF37] border-t-transparent rounded-full animate-spin" />
        <p className="text-xs uppercase tracking-wider text-[#D4AF37]">Loading order status...</p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-[#0B0A09] text-[#F7EFD9] flex flex-col items-center justify-center p-6 space-y-4">
        <AlertCircle className="w-12 h-12 text-[#FF8585]" />
        <h1 className="font-serif text-2xl font-bold">Order Not Found</h1>
        <p className="text-sm text-[#F7EFD9]/60 max-w-sm text-center">
          {error || `No order matching reference '${code}' could be retrieved.`}
        </p>
        <Link
          href="/menu"
          className="mt-2 bg-[#D4AF37] text-[#0B0A09] font-bold text-xs uppercase tracking-wider py-2.5 px-5 rounded-xl"
        >
          Return to Menu
        </Link>
      </div>
    );
  }

  const badge = getStatusBadge(order.status);
  const whatsappConfirmUrl = `https://wa.me/2348033729125?text=${encodeURIComponent(
    `Hello Rock UC Foods, I am sending payment proof for order ${order.orderCode} (${formatMoneyKobo(
      BigInt(order.totalKobo)
    )}).`
  )}`;

  return (
    <div className="min-h-screen bg-[#0B0A09] text-[#F7EFD9] py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-[#D4AF37]/20 pb-4">
          <Link
            href="/menu"
            className="inline-flex items-center gap-2 text-xs uppercase tracking-wider text-[#D4AF37] hover:text-[#F7EFD9] font-semibold transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Menu</span>
          </Link>

          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 text-xs text-[#F7EFD9]/70 hover:text-[#D4AF37] transition-colors cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Receipt</span>
          </button>
        </div>

        {/* Confirmation Card */}
        <div className="bg-[#17120F] border border-[#D4AF37]/40 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#D4AF37]/20 pb-6">
            <div className="space-y-1">
              <span className="text-[10px] uppercase tracking-widest text-[#D4AF37] font-semibold">
                Order Tracking &amp; Status
              </span>
              <h1 className="font-serif text-2xl sm:text-3xl font-bold text-[#F7EFD9] tracking-tight">
                {order.orderCode}
              </h1>
              <p className="text-xs text-[#F7EFD9]/60">
                Placed on {new Date(order.createdAt).toLocaleString('en-NG', { timeZone: 'Africa/Lagos' })}
              </p>
            </div>

            <div className="flex flex-col items-start sm:items-end gap-1.5">
              <span
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold border uppercase tracking-wider ${badge.color}`}
              >
                {badge.label}
              </span>

              {/* 15-minute countdown pill */}
              {timeLeftSeconds !== null && (
                <div className="flex items-center gap-1.5 text-xs text-[#D4AF37] bg-[#0B0A09] px-3 py-1 rounded-lg border border-[#D4AF37]/30">
                  <Clock className="w-3.5 h-3.5" />
                  <span>
                    Expires in:{' '}
                    <strong className="font-mono">{formatCountdown(timeLeftSeconds)}</strong>
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* WhatsApp Payment Confirmation CTA */}
          {order.status === 'pending_payment' && (
            <div className="p-4 rounded-2xl bg-[#6B1230]/40 border border-[#D4AF37]/40 space-y-3">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-[#D4AF37] shrink-0 mt-0.5" />
                <div className="space-y-1 text-xs">
                  <p className="font-bold text-[#F7EFD9]">
                    To lock your order, please complete bank transfer of{' '}
                    <span className="text-[#D4AF37] font-sans font-bold text-sm">
                      {formatMoneyKobo(BigInt(order.totalKobo))}
                    </span>
                  </p>
                  <p className="text-[#F7EFD9]/80 font-mono">
                    Access Bank • 0803372912 • Chef Esther Kwentua
                  </p>
                </div>
              </div>

              <a
                href={whatsappConfirmUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full bg-[#6B1230] hover:bg-[#85163C] text-[#F7EFD9] border border-[#D4AF37]/50 hover:border-[#D4AF37] py-3 px-4 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 text-center"
              >
                <MessageCircle className="w-4 h-4 text-[#D4AF37]" />
                <span>Send Payment Proof on WhatsApp</span>
              </a>
            </div>
          )}

          {/* Customer & Fulfilment Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-4 rounded-xl bg-[#0B0A09] border border-[#D4AF37]/20 space-y-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#D4AF37]">
                Customer
              </span>
              <p className="font-semibold text-sm text-[#F7EFD9]">{order.customerName}</p>
              <p className="text-[#F7EFD9]/70 font-mono">{order.customerPhone}</p>
              {order.customerEmail && <p className="text-[#F7EFD9]/60">{order.customerEmail}</p>}
            </div>

            <div className="p-4 rounded-xl bg-[#0B0A09] border border-[#D4AF37]/20 space-y-1">
              <div className="flex items-center gap-1.5 text-[10px] uppercase font-bold tracking-wider text-[#D4AF37]">
                {order.deliveryType === 'delivery' ? (
                  <>
                    <Truck className="w-3.5 h-3.5" />
                    <span>Lagos Delivery</span>
                  </>
                ) : (
                  <>
                    <Store className="w-3.5 h-3.5" />
                    <span>Kitchen Pick-up</span>
                  </>
                )}
              </div>
              <p className="text-xs text-[#F7EFD9] leading-relaxed">
                {order.deliveryType === 'delivery'
                  ? order.deliveryAddress
                  : BUSINESS_CONTACT.collectionAddress}
              </p>
            </div>
          </div>

          {/* Itemized Snapshot */}
          <div className="space-y-3 border-t border-[#D4AF37]/20 pt-4">
            <h3 className="font-serif text-sm font-bold uppercase tracking-wider text-[#D4AF37]">
              Itemized Receipt
            </h3>

            <div className="space-y-2">
              {order.items.map((item) => (
                <div
                  key={item.id}
                  className="p-3 rounded-xl bg-[#0B0A09]/60 border border-[#D4AF37]/15 flex items-start justify-between gap-3 text-xs"
                >
                  <div>
                    <span className="font-bold text-[#F7EFD9]">
                      {item.quantity}x {item.nameSnapshot}
                    </span>
                    {item.selectedTierName && (
                      <span className="block text-[10px] text-[#D4AF37] font-semibold">
                        Size: {item.selectedTierName}
                      </span>
                    )}
                    {item.selectedOptionsSnapshot && item.selectedOptionsSnapshot.length > 0 && (
                      <span className="block text-[11px] text-[#F7EFD9]/65 italic">
                        + {item.selectedOptionsSnapshot.map((o) => o.name).join(', ')}
                      </span>
                    )}
                  </div>
                  <span className="font-mono font-bold text-[#D4AF37]">
                    {formatMoneyKobo(BigInt(item.totalKoboSnapshot))}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Totals Summary */}
          <div className="border-t border-[#D4AF37]/20 pt-4 space-y-2 text-xs">
            <div className="flex justify-between text-[#F7EFD9]/70">
              <span>Subtotal</span>
              <span className="font-mono">{formatMoneyKobo(BigInt(order.subtotalKobo))}</span>
            </div>
            <div className="flex justify-between text-[#F7EFD9]/70">
              <span>Fulfilment Fee</span>
              <span className="font-mono">{formatMoneyKobo(BigInt(order.deliveryFeeKobo))}</span>
            </div>
            <div className="border-t border-[#D4AF37]/30 pt-2.5 flex items-baseline justify-between text-base font-bold text-[#D4AF37]">
              <span>Grand Total</span>
              <span className="font-sans text-xl">
                {formatMoneyKobo(BigInt(order.totalKobo))}
              </span>
            </div>
          </div>

          {/* Allergen advisory */}
          <div className="p-3 rounded-lg bg-[#0B0A09]/70 border border-[#D4AF37]/20 flex items-start gap-2 text-[11px] text-[#F7EFD9]/60 leading-relaxed">
            <ShoppingBag className="w-3.5 h-3.5 text-[#D4AF37] shrink-0 mt-0.5" />
            <span>{ALLERGEN_NOTICE}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
