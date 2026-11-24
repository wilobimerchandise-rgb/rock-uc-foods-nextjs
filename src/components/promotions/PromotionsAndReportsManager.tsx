'use client';

/**
 * ROCK UC FOODS - Promotions, Sales Reports & CSV Export Hub
 * Playbook v2 Section 12 (Phase 7: Reports, Promotions and Exports) & Section 35
 */

import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  Tag,
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
import { formatNaira, parseNairaToKobo } from '../../lib/money';

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
        setPromos(data.promotions || data.promos || []);
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

    Promise.all([
      fetch(url).then((r) => r.json()),
      fetch('/api/promotions').then((r) => r.json()),
    ])
      .then(([repData, promoData]) => {
        if (!ignore) {
          if (repData.report) setReport(repData.report);
          if (promoData.promotions || promoData.promos) {
            setPromos(promoData.promotions || promoData.promos);
          }
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
      const discVal =
        newType === 'percentage'
          ? BigInt(Math.max(1, Math.min(100, parseInt(newValue || '0', 10) || 0)))
          : parseNairaToKobo(newValue || '0');

      const minOrderKobo = parseNairaToKobo(newMinOrder || '0');
      const maxCapKobo = newMaxCap.trim() ? parseNairaToKobo(newMaxCap) : undefined;

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
    <div className="space-y-6 text-[var(--text-primary)] min-w-0 max-w-full">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[var(--border-subtle-card)]">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#6B1230] border border-[#D4AF37]/50 flex items-center justify-center shrink-0">
              <TrendingUp className="w-5 h-5 text-[#D4AF37]" />
            </div>
            <h2 className="text-xl md:text-2xl font-black text-[var(--text-primary)] tracking-tight">
              Financial Reports &amp; Promotions Engine
            </h2>
          </div>
          <p className="text-sm text-[var(--text-body-muted)] mt-1">
            Playbook v2 Section 12: BigInt revenue ledger, Lagos delivery zone breakdown, and sanitized CSV exports.
          </p>
        </div>

        {/* View Switcher */}
        <div className="flex flex-wrap items-center gap-2 bg-[var(--bg-surface-muted)] p-1.5 rounded-xl border border-[var(--border-card)] shrink-0">
          <button
            type="button"
            onClick={() => setActiveView('reports')}
            className={`min-h-[44px] px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5 transition-all ${
              activeView === 'reports'
                ? 'bg-[#6B1230] text-[#F7EFD9] border border-[#D4AF37]/50'
                : 'text-[var(--text-body-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            <TrendingUp className="w-4 h-4 shrink-0" /> Sales Analytics
          </button>
          <button
            type="button"
            onClick={() => setActiveView('promotions')}
            className={`min-h-[44px] px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5 transition-all ${
              activeView === 'promotions'
                ? 'bg-[#6B1230] text-[#F7EFD9] border border-[#D4AF37]/50'
                : 'text-[var(--text-body-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Tag className="w-4 h-4 shrink-0" /> Promo Codes ({promos.length})
          </button>
        </div>
      </div>

      {errorMsg && (
        <div
          role="alert"
          className="p-3.5 bg-[var(--status-danger-bg)] border border-[var(--status-danger-border)] rounded-xl text-sm text-[var(--status-danger-text)] flex items-center gap-2"
        >
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div
          role="status"
          className="p-3.5 bg-[var(--status-success-bg)] border border-[var(--status-success-border)] rounded-xl text-sm text-[var(--status-success-text)] flex items-center gap-2"
        >
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* VIEW 1: SALES REPORTS & CSV EXPORT */}
      {activeView === 'reports' && (
        <div className="space-y-6">
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-[var(--bg-card)] border border-[var(--border-card)] rounded-2xl">
            <div className="flex items-center gap-2 overflow-x-auto [overscroll-behavior-x:contain] no-scrollbar min-w-0 max-w-full">
              <span className="text-sm font-semibold text-[var(--text-body-muted)] mr-1 flex items-center gap-1.5 shrink-0">
                <Calendar className="w-4 h-4" /> Timeframe:
              </span>
              {(['all', 'today', '7d', '30d'] as const).map((r) => (
                <button
                  type="button"
                  key={r}
                  onClick={() => setDateRange(r)}
                  className={`min-h-[44px] px-3.5 py-2 rounded-xl text-sm font-semibold shrink-0 transition-all border ${
                    dateRange === r
                      ? 'bg-[#6B1230] text-[#F7EFD9] border-[#D4AF37]'
                      : 'bg-[var(--bg-surface-muted)] text-[var(--text-body-muted)] border-[var(--border-subtle-card)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {r === 'all' ? 'All Time' : r === 'today' ? 'Today' : r === '7d' ? 'Past 7 Days' : 'Past 30 Days'}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={loadAll}
                disabled={loading}
                className="min-h-[44px] px-4 py-2 bg-[var(--bg-surface-muted)] hover:border-[var(--border-gold)] border border-[var(--border-card)] rounded-xl text-sm font-semibold text-[var(--text-primary)] inline-flex items-center gap-1.5"
              >
                <RefreshCw className={`w-4 h-4 text-[var(--text-accent)] ${loading ? 'animate-spin' : ''}`} />
                <span>Sync</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadCsv}
                disabled={exportingCsv || !report || report.totalOrders === 0}
                className="btn-luxury px-4 py-2 rounded-xl text-sm font-bold inline-flex items-center gap-1.5 shadow-lg disabled:opacity-50"
              >
                <FileSpreadsheet className="w-4 h-4 shrink-0" />
                <span>{exportingCsv ? 'Preparing CSV...' : 'Export Financial CSV'}</span>
              </button>
            </div>
          </div>

          {/* Revenue KPI Cards */}
          {report && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-[var(--status-success-bg)] border border-[var(--status-success-border)] rounded-2xl">
                <span className="text-sm text-[var(--status-success-text)] font-semibold uppercase flex items-center gap-1">
                  <DollarSign className="w-4 h-4 shrink-0" /> Net Revenue Received
                </span>
                <div className="text-xl md:text-2xl font-black text-[var(--status-success-text)] mt-1 font-mono price-tabular">
                  {formatNaira(BigInt(report.netRevenueKobo))}
                </div>
                <span className="text-sm text-[var(--status-success-text)] opacity-90">
                  Bank-verified funds
                </span>
              </div>

              <div className="p-4 bg-[var(--bg-card)] border border-[var(--border-card)] rounded-2xl">
                <span className="text-sm text-[var(--text-accent)] font-semibold uppercase flex items-center gap-1">
                  <ShoppingBag className="w-4 h-4 shrink-0" /> Total Paid Orders
                </span>
                <div className="text-xl md:text-2xl font-black text-[var(--text-primary)] mt-1 price-tabular">
                  {report.totalOrders}
                </div>
                <span className="text-sm text-[var(--text-body-muted)] price-tabular">
                  Avg Value: {formatNaira(BigInt(report.averageOrderValueKobo))}
                </span>
              </div>

              <div className="p-4 bg-[var(--bg-card)] border border-[var(--border-card)] rounded-2xl">
                <span className="text-sm text-[var(--status-warning-text)] font-semibold uppercase flex items-center gap-1">
                  <TrendingUp className="w-4 h-4 shrink-0" /> Food Gross Subtotal
                </span>
                <div className="text-xl md:text-2xl font-black text-[var(--text-primary)] mt-1 font-mono price-tabular">
                  {formatNaira(BigInt(report.grossRevenueKobo))}
                </div>
                <span className="text-sm text-[var(--text-body-muted)]">
                  Before delivery &amp; discounts
                </span>
              </div>

              <div className="p-4 bg-[var(--bg-card)] border border-[var(--border-card)] rounded-2xl">
                <span className="text-sm text-[var(--status-info-text)] font-semibold uppercase flex items-center gap-1">
                  <ShieldCheck className="w-4 h-4 shrink-0" /> Delivery Fees Collected
                </span>
                <div className="text-xl md:text-2xl font-black text-[var(--text-primary)] mt-1 font-mono price-tabular">
                  {formatNaira(BigInt(report.totalDeliveryFeesKobo))}
                </div>
                <span className="text-sm text-[var(--text-body-muted)]">
                  Lagos logistics remittance
                </span>
              </div>
            </div>
          )}

          {/* Lagos Delivery Zone Breakdown */}
          {report && (
            <div className="p-5 bg-[var(--bg-card)] border border-[var(--border-card)] rounded-2xl space-y-3">
              <h3 className="text-base font-bold text-[var(--text-primary)] flex items-center gap-2">
                <span>📍 Lagos Delivery Zone Distribution</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-5 gap-3">
                {Object.entries(report.zoneBreakdown).map(([zoneId, data]) => (
                  <div
                    key={zoneId}
                    className="p-3.5 bg-[var(--bg-surface-muted)] border border-[var(--border-subtle-card)] rounded-xl space-y-1"
                  >
                    <span className="text-sm text-[var(--text-accent)] font-mono font-bold uppercase block">
                      {zoneId}
                    </span>
                    <div className="text-base font-bold text-[var(--text-primary)] font-mono price-tabular">
                      {formatNaira(BigInt(data.revenueKobo))}
                    </div>
                    <span className="text-sm text-[var(--text-body-muted)] block price-tabular">
                      {data.orderCount} {data.orderCount === 1 ? 'order' : 'orders'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Dish Popularity Leaderboard */}
          {report && (
            <div className="p-5 bg-[var(--bg-card)] border border-[var(--border-card)] rounded-2xl space-y-3">
              <h3 className="text-base font-bold text-[var(--text-primary)] flex items-center gap-2">
                <Award className="w-4 h-4 text-[var(--text-accent)] shrink-0" />
                <span>Culinary Dish Popularity Leaderboard</span>
              </h3>

              {report.itemPopularity.length === 0 ? (
                <div className="py-8 text-center text-sm text-[var(--text-body-muted)]">
                  No menu dish sales recorded in this timeframe.
                </div>
              ) : (
                <div className="divide-y divide-[var(--border-subtle-card)]">
                  {report.itemPopularity.map((item, idx) => (
                    <div
                      key={item.menuItemId}
                      className="py-3 flex items-center justify-between gap-3 text-sm"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-7 h-7 rounded-md bg-[var(--bg-surface-muted)] border border-[var(--border-card)] text-[var(--text-accent)] font-mono font-bold text-sm flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <div className="min-w-0">
                          <span className="font-semibold text-[var(--text-primary)] block truncate">
                            {item.name}
                          </span>
                          <span className="text-sm text-[var(--text-body-muted)]">
                            {item.quantity} portions served
                          </span>
                        </div>
                      </div>

                      <div className="font-mono font-bold text-[var(--text-primary)] price-tabular shrink-0">
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
          <div className="flex flex-wrap items-center justify-between gap-3 pb-2">
            <div>
              <h3 className="text-base font-bold text-[var(--text-primary)]">
                Active Promo Codes &amp; Vouchers
              </h3>
              <p className="text-sm text-[var(--text-body-muted)]">
                Configure discount rates, minimum subtotal thresholds, and usage caps.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="btn-luxury px-4 py-2 rounded-xl text-sm font-bold inline-flex items-center gap-1.5 shadow-lg shrink-0"
            >
              <Plus className="w-4 h-4 shrink-0" />
              <span>Create Promo Code</span>
            </button>
          </div>

          {promos.length === 0 ? (
            <div className="p-8 bg-[var(--bg-card)] border border-[var(--border-card)] rounded-2xl text-center text-sm text-[var(--text-body-muted)] space-y-3">
              <Tag className="w-8 h-8 text-[var(--text-body-muted)] mx-auto" />
              <p>No promo codes created yet.</p>
              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                className="min-h-[44px] px-4 py-2 rounded-xl border border-[var(--border-gold)] text-[var(--text-accent)] font-semibold hover:bg-[var(--bg-surface-muted)]"
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
                        ? 'bg-[var(--bg-surface-muted)] border-[var(--border-subtle-card)] opacity-75'
                        : 'bg-[var(--bg-card)] border-[var(--border-card)] hover:border-[var(--border-gold)]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 pb-2 border-b border-[var(--border-subtle-card)]">
                      <div className="flex flex-wrap items-center gap-2 min-w-0">
                        <span className="font-mono text-sm font-black tracking-wider text-[var(--text-accent)] bg-[var(--bg-surface-muted)] px-2.5 py-0.5 rounded-md border border-[var(--border-card)]">
                          {p.code}
                        </span>
                        {p.description && (
                          <span className="text-sm text-[var(--text-body-muted)] truncate">
                            {p.description}
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleTogglePromo(p.id)}
                        aria-label={p.isActive ? `Deactivate promo ${p.code}` : `Activate promo ${p.code}`}
                        className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-lg text-[var(--text-body-muted)] hover:text-[var(--text-primary)] shrink-0"
                        title={p.isActive ? 'Deactivate' : 'Activate'}
                      >
                        {p.isActive ? (
                          <ToggleRight className="w-7 h-7 text-[var(--text-money-positive)]" />
                        ) : (
                          <ToggleLeft className="w-7 h-7 text-[var(--text-body-muted)]" />
                        )}
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-[var(--text-body-muted)] text-sm block">Discount</span>
                        <span className="font-bold text-[var(--text-primary)] font-mono price-tabular">
                          {p.discountType === 'percentage'
                            ? `${p.discountValue}% OFF`
                            : formatNaira(BigInt(p.discountValue))}
                        </span>
                      </div>

                      <div>
                        <span className="text-[var(--text-body-muted)] text-sm block">Min Subtotal</span>
                        <span className="font-mono price-tabular text-[var(--text-primary)]">
                          {formatNaira(BigInt(p.minOrderKobo))}
                        </span>
                      </div>

                      <div>
                        <span className="text-[var(--text-body-muted)] text-sm block">Usage</span>
                        <span className="font-mono price-tabular text-[var(--text-primary)]">
                          {p.usedCount} / {p.usageLimit !== undefined ? p.usageLimit : '∞'} uses
                        </span>
                      </div>

                      <div>
                        <span className="text-[var(--text-body-muted)] text-sm block">Expires</span>
                        <span className="font-mono price-tabular text-[var(--text-primary)] text-sm">
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
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-promo-modal-title"
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="bg-[var(--bg-card)] border border-[var(--border-gold)] rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle-card)]">
              <h4 id="create-promo-modal-title" className="text-lg font-bold text-[var(--text-primary)]">
                Create New Promo Code
              </h4>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="min-h-[44px] px-3 rounded-lg text-[var(--text-body-muted)] hover:text-[var(--text-primary)] text-sm font-semibold"
              >
                Cancel
              </button>
            </div>

            <form onSubmit={handleCreatePromo} className="space-y-3.5 text-sm">
              <div>
                <label htmlFor="promo-code-input" className="block text-[var(--text-primary)] font-semibold mb-1.5">
                  Promo Code (3-30 chars)
                </label>
                <input
                  id="promo-code-input"
                  type="text"
                  required
                  placeholder="e.g. WELCOME10 or ROYAL2026"
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                  className="w-full min-h-[44px] px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-card)] rounded-xl text-[var(--text-primary)] font-mono placeholder:text-[var(--text-placeholder)] focus:outline-none focus:border-[var(--border-gold)]"
                />
              </div>

              <div>
                <label htmlFor="promo-desc-input" className="block text-[var(--text-primary)] font-semibold mb-1.5">
                  Description (Optional)
                </label>
                <input
                  id="promo-desc-input"
                  type="text"
                  placeholder="e.g. 10% Welcome Discount"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="w-full min-h-[44px] px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-card)] rounded-xl text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none focus:border-[var(--border-gold)]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="promo-type-select" className="block text-[var(--text-primary)] font-semibold mb-1.5">
                    Discount Type
                  </label>
                  <select
                    id="promo-type-select"
                    value={newType}
                    onChange={(e) => setNewType(e.target.value as any)}
                    className="w-full min-h-[44px] px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-card)] rounded-xl text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-gold)]"
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed_amount">Fixed Amount (₦)</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="promo-value-input" className="block text-[var(--text-primary)] font-semibold mb-1.5">
                    {newType === 'percentage' ? 'Percentage (1 - 100)' : 'Amount in Naira (₦)'}
                  </label>
                  <input
                    id="promo-value-input"
                    type="number"
                    required
                    min="1"
                    max={newType === 'percentage' ? '100' : undefined}
                    value={newValue}
                    onChange={(e) => setNewValue(e.target.value)}
                    className="w-full min-h-[44px] px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-card)] rounded-xl text-[var(--text-primary)] price-tabular focus:outline-none focus:border-[var(--border-gold)]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="promo-min-order" className="block text-[var(--text-primary)] font-semibold mb-1.5">
                    Min Subtotal (₦)
                  </label>
                  <input
                    id="promo-min-order"
                    type="number"
                    min="0"
                    placeholder="0"
                    value={newMinOrder}
                    onChange={(e) => setNewMinOrder(e.target.value)}
                    className="w-full min-h-[44px] px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-card)] rounded-xl text-[var(--text-primary)] price-tabular focus:outline-none focus:border-[var(--border-gold)]"
                  />
                </div>

                <div>
                  <label htmlFor="promo-max-cap" className="block text-[var(--text-primary)] font-semibold mb-1.5">
                    Max Cap ₦ (Optional)
                  </label>
                  <input
                    id="promo-max-cap"
                    type="number"
                    min="0"
                    placeholder="e.g. 5000"
                    value={newMaxCap}
                    onChange={(e) => setNewMaxCap(e.target.value)}
                    className="w-full min-h-[44px] px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-card)] rounded-xl text-[var(--text-primary)] price-tabular focus:outline-none focus:border-[var(--border-gold)]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="promo-usage-limit" className="block text-[var(--text-primary)] font-semibold mb-1.5">
                    Usage Limit (Optional)
                  </label>
                  <input
                    id="promo-usage-limit"
                    type="number"
                    min="1"
                    placeholder="Unlimited"
                    value={newUsageLimit}
                    onChange={(e) => setNewUsageLimit(e.target.value)}
                    className="w-full min-h-[44px] px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-card)] rounded-xl text-[var(--text-primary)] price-tabular focus:outline-none focus:border-[var(--border-gold)]"
                  />
                </div>

                <div>
                  <label htmlFor="promo-end-date" className="block text-[var(--text-primary)] font-semibold mb-1.5">
                    Expiry Date
                  </label>
                  <input
                    id="promo-end-date"
                    type="date"
                    required
                    value={newEndDate}
                    onChange={(e) => setNewEndDate(e.target.value)}
                    className="w-full min-h-[44px] px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-card)] rounded-xl text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-gold)]"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="min-h-[44px] px-4 py-2 rounded-xl border border-[var(--border-subtle-card)] text-[var(--text-body-muted)] hover:text-[var(--text-primary)]"
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
