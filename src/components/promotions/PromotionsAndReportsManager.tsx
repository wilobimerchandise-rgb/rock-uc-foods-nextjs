'use client';

/**
 * ROCK UC FOODS - Promotions, Sales Reports & CSV Export Hub
 * Playbook v2 Section 12 (Phase 7: Reports, Promotions and Exports)
 */

import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  Tag,
  Download,
  Calendar,
  DollarSign,
  ShoppingBag,
  Award,
  RefreshCw,
  Plus,
  CheckCircle2,
  AlertCircle,
  ToggleLeft,
  ToggleRight,
  ShieldCheck,
  FileSpreadsheet,
} from 'lucide-react';
import { formatNaira } from '../../lib/money';

interface ReportData {
  generatedAt: string;
  startDate: string;
  endDate: string;
  totalOrders: number;
  grossRevenueKobo: string;
  totalDiscountsKobo: string;
  totalDeliveryFeesKobo: string;
  netRevenueKobo: string;
  averageOrderValueKobo: string;
  zoneBreakdown: Record<string, { zoneId: string; orderCount: number; revenueKobo: string }>;
  itemPopularity: Array<{ menuItemId: string; name: string; quantity: number; revenueKobo: string }>;
}

interface PromoData {
  id: string;
  code: string;
  description?: string;
  discountType: 'percentage' | 'fixed_amount';
  discountValue: string;
  minOrderKobo: string;
  maxDiscountKobo?: string | null;
  usageLimit?: number;
  usedCount: number;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

export function PromotionsAndReportsManager() {
  const [activeView, setActiveView] = useState<'reports' | 'promotions'>('reports');
  const [dateRange, setDateRange] = useState<'all' | 'today' | '7d' | '30d'>('all');
  const [report, setReport] = useState<ReportData | null>(null);
  const [promos, setPromos] = useState<PromoData[]>([]);
  const [loading, setLoading] = useState(true);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [nowTimestamp] = useState(() => Date.now());

  // New Promo Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newType, setNewType] = useState<'percentage' | 'fixed_amount'>('percentage');
  const [newValue, setNewValue] = useState('10');
  const [newMinOrder, setNewMinOrder] = useState('0');
  const [newMaxCap, setNewMaxCap] = useState('');
  const [newUsageLimit, setNewUsageLimit] = useState('');
  const [newEndDate, setNewEndDate] = useState('');
  const [creatingPromo, setCreatingPromo] = useState(false);

  const fetchReports = async () => {
    try {
      let url = '/api/reports/sales';
      const now = new Date();
      if (dateRange === 'today') {
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
        url += `?startDate=${encodeURIComponent(start)}`;
      } else if (dateRange === '7d') {
        const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
        url += `?startDate=${encodeURIComponent(start)}`;
      } else if (dateRange === '30d') {
        const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
        url += `?startDate=${encodeURIComponent(start)}`;
      }

      const res = await fetch(url);
      const data = await res.json();
      if (res.ok) {
        setReport(data.report);
      }
    } catch {
      // Offline fallback
    }
  };

  const fetchPromos = async () => {
    try {
      const res = await fetch('/api/promotions');
      const data = await res.json();
      if (res.ok) {
        setPromos(data.promos || []);
      }
    } catch {
      // Offline fallback
    }
  };

  const loadAll = async () => {
    setLoading(true);
    await Promise.all([fetchReports(), fetchPromos()]);
    setLoading(false);
  };

  useEffect(() => {
    let ignore = false;
    Promise.all([
      fetch('/api/reports/sales').then((r) => r.json()),
      fetch('/api/promotions').then((r) => r.json()),
    ])
      .then(([repData, promoData]) => {
        if (!ignore) {
          if (repData.report) setReport(repData.report);
          if (promoData.promotions) setPromos(promoData.promotions);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [dateRange]);

  const handleDownloadCsv = () => {
    setExportingCsv(true);
    let url = '/api/reports/sales?format=csv';
    const now = new Date();
    if (dateRange === 'today') {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      url += `&startDate=${encodeURIComponent(start)}`;
    } else if (dateRange === '7d') {
      const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      url += `&startDate=${encodeURIComponent(start)}`;
    } else if (dateRange === '30d') {
      const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      url += `&startDate=${encodeURIComponent(start)}`;
    }

    const a = document.createElement('a');
    a.href = url;
    a.download = `rock-uc-foods-sales-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setExportingCsv(false);
  };

  const handleTogglePromo = async (id: string) => {
    try {
      const res = await fetch('/api/promotions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle', id }),
      });
      if (res.ok) {
        await fetchPromos();
      }
    } catch {
      // Ignore
    }
  };

  const handleCreatePromo = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingPromo(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      // Value in kobo if fixed amount
      const discVal =
        newType === 'percentage'
          ? BigInt(Math.floor(Number(newValue) || 0))
          : BigInt(Math.floor(Number(newValue) * 100 || 0));

      const minOrderKobo = BigInt(Math.floor(Number(newMinOrder) * 100 || 0));
      const maxCapKobo = newMaxCap ? BigInt(Math.floor(Number(newMaxCap) * 100 || 0)) : undefined;

      const res = await fetch('/api/promotions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          code: newCode,
          description: newDesc,
          discountType: newType,
          discountValue: discVal.toString(),
          minOrderKobo: minOrderKobo.toString(),
          maxDiscountKobo: maxCapKobo ? maxCapKobo.toString() : undefined,
          usageLimit: newUsageLimit ? Number(newUsageLimit) : undefined,
          endDate: new Date(newEndDate).toISOString(),
          isActive: true,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Failed to create promo code.');
      } else {
        setSuccessMsg(`Promo code '${newCode.toUpperCase()}' created successfully.`);
        setShowCreateModal(false);
        setNewCode('');
        setNewDesc('');
        setNewValue('10');
        setNewMinOrder('0');
        setNewMaxCap('');
        setNewUsageLimit('');
        setNewEndDate('');
        await fetchPromos();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create promo code.');
    } finally {
      setCreatingPromo(false);
    }
  };

  return (
    <div className="space-y-6 text-[#F7EFD9]">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#6B1230] border border-[#D4AF37]/50 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-[#D4AF37]" />
            </div>
            <h2 className="text-xl md:text-2xl font-black text-[#F7EFD9] tracking-tight">
              Financial Reports &amp; Promotions Engine
            </h2>
          </div>
          <p className="text-xs text-[#F7EFD9]/60 mt-1">
            Playbook v2 Section 12: BigInt revenue ledger, Lagos delivery zone breakdown, and sanitized CSV exports.
          </p>
        </div>

        {/* View Switcher */}
        <div className="flex items-center gap-2 bg-[#0B0A09] p-1 rounded-xl border border-white/10">
          <button
            onClick={() => setActiveView('reports')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeView === 'reports'
                ? 'bg-[#6B1230] text-white border border-[#D4AF37]/50'
                : 'text-stone-400 hover:text-white'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" /> Sales Analytics
          </button>
          <button
            onClick={() => setActiveView('promotions')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeView === 'promotions'
                ? 'bg-[#6B1230] text-white border border-[#D4AF37]/50'
                : 'text-stone-400 hover:text-white'
            }`}
          >
            <Tag className="w-3.5 h-3.5" /> Promo Codes ({promos.length})
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 bg-rose-950/60 border border-rose-500/50 rounded-xl text-xs text-rose-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3 bg-emerald-950/60 border border-emerald-500/50 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* VIEW 1: SALES REPORTS & CSV EXPORT */}
      {activeView === 'reports' && (
        <div className="space-y-6">
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-[#17120F] border border-white/10 rounded-2xl">
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
              <span className="text-xs font-semibold text-stone-400 mr-2 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" /> Timeframe:
              </span>
              {(['all', 'today', '7d', '30d'] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setDateRange(r)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                    dateRange === r
                      ? 'bg-[#6B1230] text-[#F7EFD9] border border-[#D4AF37]'
                      : 'bg-white/5 text-stone-400 hover:text-white'
                  }`}
                >
                  {r === 'all' ? 'All Time' : r === 'today' ? 'Today' : r === '7d' ? 'Past 7 Days' : 'Past 30 Days'}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={loadAll}
                disabled={loading}
                className="px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-semibold text-stone-300 flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span>Sync</span>
              </button>

              <button
                onClick={handleDownloadCsv}
                disabled={exportingCsv || !report || report.totalOrders === 0}
                className="btn-luxury px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>{exportingCsv ? 'Preparing CSV...' : 'Export Financial CSV'}</span>
              </button>
            </div>
          </div>

          {/* Revenue KPI Cards */}
          {report && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-emerald-950/30 border border-emerald-500/40 rounded-2xl">
                <span className="text-[11px] text-emerald-400 font-semibold uppercase flex items-center gap-1">
                  <DollarSign className="w-3.5 h-3.5" /> Net Revenue Received
                </span>
                <div className="text-xl md:text-2xl font-black text-emerald-200 mt-1 font-mono">
                  {formatNaira(BigInt(report.netRevenueKobo))}
                </div>
                <span className="text-[10px] text-emerald-400/80">Bank-verified funds</span>
              </div>

              <div className="p-4 bg-[#17120F] border border-white/10 rounded-2xl">
                <span className="text-[11px] text-[#D4AF37] font-semibold uppercase flex items-center gap-1">
                  <ShoppingBag className="w-3.5 h-3.5" /> Total Paid Orders
                </span>
                <div className="text-xl md:text-2xl font-black text-white mt-1">
                  {report.totalOrders}
                </div>
                <span className="text-[10px] text-stone-400">
                  Avg Value: {formatNaira(BigInt(report.averageOrderValueKobo))}
                </span>
              </div>

              <div className="p-4 bg-[#17120F] border border-white/10 rounded-2xl">
                <span className="text-[11px] text-amber-400 font-semibold uppercase flex items-center gap-1">
                  <TrendingUp className="w-3.5 h-3.5" /> Food Gross Subtotal
                </span>
                <div className="text-xl md:text-2xl font-black text-white mt-1 font-mono">
                  {formatNaira(BigInt(report.grossRevenueKobo))}
                </div>
                <span className="text-[10px] text-stone-400">Before delivery &amp; discounts</span>
              </div>

              <div className="p-4 bg-[#17120F] border border-white/10 rounded-2xl">
                <span className="text-[11px] text-sky-400 font-semibold uppercase flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" /> Delivery Fees Collected
                </span>
                <div className="text-xl md:text-2xl font-black text-white mt-1 font-mono">
                  {formatNaira(BigInt(report.totalDeliveryFeesKobo))}
                </div>
                <span className="text-[10px] text-stone-400">Lagos logistics remittance</span>
              </div>
            </div>
          )}

          {/* Lagos Delivery Zone Breakdown */}
          {report && (
            <div className="p-5 bg-[#17120F] border border-white/10 rounded-2xl space-y-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>📍 Lagos Delivery Zone Distribution</span>
              </h3>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                {Object.entries(report.zoneBreakdown).map(([zoneId, data]) => (
                  <div
                    key={zoneId}
                    className="p-3 bg-black/40 border border-white/5 rounded-xl space-y-1"
                  >
                    <span className="text-[10px] text-[#D4AF37] font-mono font-bold uppercase block">
                      {zoneId}
                    </span>
                    <div className="text-sm font-bold text-white font-mono">
                      {formatNaira(BigInt(data.revenueKobo))}
                    </div>
                    <span className="text-[10px] text-stone-400 block">
                      {data.orderCount} {data.orderCount === 1 ? 'order' : 'orders'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Dish Popularity Leaderboard */}
          {report && (
            <div className="p-5 bg-[#17120F] border border-white/10 rounded-2xl space-y-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Award className="w-4 h-4 text-[#D4AF37]" />
                <span>Culinary Dish Popularity Leaderboard</span>
              </h3>

              {report.itemPopularity.length === 0 ? (
                <div className="py-8 text-center text-xs text-stone-500">
                  No menu dish sales recorded in this timeframe.
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {report.itemPopularity.map((item, idx) => (
                    <div
                      key={item.menuItemId}
                      className="py-2.5 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-5 h-5 rounded-full bg-white/5 text-[#D4AF37] font-mono font-bold text-[10px] flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <div>
                          <span className="font-semibold text-white block">{item.name}</span>
                          <span className="text-[10px] text-stone-400">
                            {item.quantity} portions served
                          </span>
                        </div>
                      </div>

                      <div className="font-mono font-bold text-white">
                        {formatNaira(BigInt(item.revenueKobo))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: PROMOTIONS & COUPONS */}
      {activeView === 'promotions' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-2">
            <div>
              <h3 className="text-sm font-bold text-white">Active Promo Codes &amp; Vouchers</h3>
              <p className="text-xs text-stone-400">
                Configure discount rates, minimum subtotal thresholds, and usage caps.
              </p>
            </div>

            <button
              onClick={() => setShowCreateModal(true)}
              className="btn-luxury px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Promo Code</span>
            </button>
          </div>

          {promos.length === 0 ? (
            <div className="p-8 bg-[#17120F] border border-white/10 rounded-2xl text-center text-xs text-stone-400 space-y-2">
              <Tag className="w-8 h-8 text-stone-600 mx-auto" />
              <p>No promo codes created yet.</p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="text-[#D4AF37] font-semibold hover:underline"
              >
                Create your first coupon
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {promos.map((p) => {
                const isExpired = new Date(p.endDate).getTime() < nowTimestamp;
                const isLimitReached = p.usageLimit !== undefined && p.usedCount >= p.usageLimit;

                return (
                  <div
                    key={p.id}
                    className={`p-5 rounded-2xl border transition-all space-y-3 ${
                      !p.isActive || isExpired || isLimitReached
                        ? 'bg-stone-900/40 border-white/5 opacity-60'
                        : 'bg-[#17120F] border-white/10 hover:border-[#D4AF37]/50'
                    }`}
                  >
                    <div className="flex items-center justify-between pb-2 border-b border-white/10">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-black tracking-wider text-[#D4AF37] bg-black/40 px-2 py-0.5 rounded border border-[#D4AF37]/30">
                          {p.code}
                        </span>
                        {p.description && (
                          <span className="text-[11px] text-stone-300">{p.description}</span>
                        )}
                      </div>

                      <button
                        onClick={() => handleTogglePromo(p.id)}
                        className="text-stone-400 hover:text-white"
                        title={p.isActive ? 'Deactivate' : 'Activate'}
                      >
                        {p.isActive ? (
                          <ToggleRight className="w-6 h-6 text-emerald-400" />
                        ) : (
                          <ToggleLeft className="w-6 h-6 text-stone-600" />
                        )}
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-stone-500 text-[10px] block">Discount</span>
                        <span className="font-bold text-white font-mono">
                          {p.discountType === 'percentage'
                            ? `${p.discountValue}% OFF`
                            : formatNaira(BigInt(p.discountValue))}
                        </span>
                      </div>

                      <div>
                        <span className="text-stone-500 text-[10px] block">Min Subtotal</span>
                        <span className="font-mono text-stone-300">
                          {formatNaira(BigInt(p.minOrderKobo))}
                        </span>
                      </div>

                      <div>
                        <span className="text-stone-500 text-[10px] block">Usage</span>
                        <span className="font-mono text-stone-300">
                          {p.usedCount} / {p.usageLimit !== undefined ? p.usageLimit : '∞'} uses
                        </span>
                      </div>

                      <div>
                        <span className="text-stone-500 text-[10px] block">Expires</span>
                        <span className="font-mono text-stone-300 text-[10px]">
                          {p.endDate.split('T')[0]}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Create Promo Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#17120F] border border-[#D4AF37]/60 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h4 className="text-base font-bold text-white">Create New Promo Code</h4>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-stone-400 hover:text-white text-xs"
              >
                Cancel
              </button>
            </div>

            <form onSubmit={handleCreatePromo} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-stone-300 font-semibold mb-1">Promo Code (3-30 chars)</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. WELCOME10 or ROYAL2026"
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 bg-black/50 border border-white/10 rounded-xl text-white font-mono placeholder-stone-600 focus:outline-none focus:border-[#D4AF37]"
                />
              </div>

              <div>
                <label className="block text-stone-300 font-semibold mb-1">Description (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. 10% Welcome Discount"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="w-full px-3 py-2 bg-black/50 border border-white/10 rounded-xl text-white placeholder-stone-600 focus:outline-none focus:border-[#D4AF37]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-stone-300 font-semibold mb-1">Discount Type</label>
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value as any)}
                    className="w-full px-3 py-2 bg-black/50 border border-white/10 rounded-xl text-white focus:outline-none focus:border-[#D4AF37]"
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed_amount">Fixed Amount (₦)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-stone-300 font-semibold mb-1">
                    {newType === 'percentage' ? 'Percentage (1 - 100)' : 'Amount in Naira (₦)'}
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    max={newType === 'percentage' ? '100' : undefined}
                    value={newValue}
                    onChange={(e) => setNewValue(e.target.value)}
                    className="w-full px-3 py-2 bg-black/50 border border-white/10 rounded-xl text-white focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-stone-300 font-semibold mb-1">Min Subtotal (₦)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={newMinOrder}
                    onChange={(e) => setNewMinOrder(e.target.value)}
                    className="w-full px-3 py-2 bg-black/50 border border-white/10 rounded-xl text-white focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>

                <div>
                  <label className="block text-stone-300 font-semibold mb-1">Max Cap ₦ (Optional)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 5000"
                    value={newMaxCap}
                    onChange={(e) => setNewMaxCap(e.target.value)}
                    className="w-full px-3 py-2 bg-black/50 border border-white/10 rounded-xl text-white focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-stone-300 font-semibold mb-1">Usage Limit (Optional)</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="Unlimited"
                    value={newUsageLimit}
                    onChange={(e) => setNewUsageLimit(e.target.value)}
                    className="w-full px-3 py-2 bg-black/50 border border-white/10 rounded-xl text-white focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>

                <div>
                  <label className="block text-stone-300 font-semibold mb-1">Expiry Date</label>
                  <input
                    type="date"
                    required
                    value={newEndDate}
                    onChange={(e) => setNewEndDate(e.target.value)}
                    className="w-full px-3 py-2 bg-black/50 border border-white/10 rounded-xl text-white focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl text-stone-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingPromo}
                  className="btn-luxury px-5 py-2 rounded-xl font-bold shadow-lg"
                >
                  {creatingPromo ? 'Creating...' : 'Create Promo Code'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
