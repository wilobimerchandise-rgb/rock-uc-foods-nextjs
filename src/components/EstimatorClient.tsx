'use client';

/**
 * ROCK UC FOODS - Public Catering Estimator
 * Playbook v4 Section 20
 */

import React, { useState, useMemo } from 'react';
import {
  Users,
  CheckCircle,
  Check,
  ExternalLink,
  ShieldAlert,
  Sparkles,
  Calculator,
} from 'lucide-react';
import {
  INITIAL_ESTIMATOR_TIERS,
  INITIAL_ESTIMATOR_ADD_ONS,
  INITIAL_SERVICE_RATES,
  deserializeEstimatorConfig,
} from '../estimator/config';
import { EstimatorConfig, EstimatorConfigJson } from '../estimator/types';
import { computeEstimate } from '../estimator/compute';
import { formatNaira } from '../lib/money';
import { BUSINESS_CONTACT, ALLERGEN_NOTICE } from '../policy/content';

export interface EstimatorClientProps {
  initialTierId?: string;
  initialConfig?: EstimatorConfigJson;
}

export function EstimatorClient({ initialTierId, initialConfig }: EstimatorClientProps = {}) {
  const config: EstimatorConfig = useMemo(() => {
    if (initialConfig) {
      return deserializeEstimatorConfig(initialConfig);
    }
    return {
      id: 'default',
      version: 1,
      tiers: INITIAL_ESTIMATOR_TIERS,
      addOns: INITIAL_ESTIMATOR_ADD_ONS,
      serviceRates: INITIAL_SERVICE_RATES,
      updatedAt: '',
      updatedBy: '',
    };
  }, [initialConfig]);

  const initialTier = useMemo(() => {
    if (initialTierId) {
      const matched = config.tiers.find((t) => t.id === initialTierId);
      if (matched) return matched;
    }
    return config.tiers.find((t) => t.id === 'tier-silver') || config.tiers[0];
  }, [config.tiers, initialTierId]);

  const [guestCount, setGuestCount] = useState<number>(() => {
    const base = initialTier?.id === 'tier-silver' ? 100 : initialTier?.minGuests ?? 100;
    return Math.min(initialTier?.maxGuests ?? 1000, Math.max(initialTier?.minGuests ?? 20, base));
  });
  const [selectedTierId, setSelectedTierId] = useState<string>(initialTier?.id || 'tier-silver');
  const [selectedAddOnMap, setSelectedAddOnMap] = useState<Record<string, number>>({
    'addon-smallchops': 1,
    'addon-tableware': 1,
  });

  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [isRequestingInvoice, setIsRequestingInvoice] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [requestedRef, setRequestedRef] = useState<string | null>(null);

  // Ensure selected tier is compatible with guest count
  const activeTier = useMemo(() => {
    const tier = config.tiers.find((t) => t.id === selectedTierId);
    if (tier && guestCount >= tier.minGuests && guestCount <= tier.maxGuests) {
      return tier;
    }
    const fitting = config.tiers.find(
      (t) => guestCount >= t.minGuests && guestCount <= t.maxGuests
    );
    return fitting || config.tiers[0];
  }, [config.tiers, selectedTierId, guestCount]);

  // Compute live estimate using BigInt kobo math
  const estimateResult = useMemo(() => {
    const addOnInputs = Object.entries(selectedAddOnMap)
      .filter(([, qty]) => qty > 0)
      .map(([addOnId, quantity]) => ({ addOnId, quantity }));

    try {
      return computeEstimate(
        {
          tierId: activeTier.id,
          guestCount,
          selectedAddOns: addOnInputs,
        },
        config
      );
    } catch {
      return null;
    }
  }, [activeTier, guestCount, selectedAddOnMap, config]);

  const toggleAddOn = (addOnId: string) => {
    setSelectedAddOnMap((prev) => {
      const current = prev[addOnId] || 0;
      if (current > 0) {
        const copy = { ...prev };
        delete copy[addOnId];
        return copy;
      }
      return { ...prev, [addOnId]: 1 };
    });
  };

  const whatsappNumber = (BUSINESS_CONTACT.phoneInternational || '+2348033729125').replace(/\D/g, '');

  const handleRequestInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!estimateResult || isRequestingInvoice) return;
    setIsRequestingInvoice(true);
    setRequestError(null);

    try {
      const addOnInputs = Object.entries(selectedAddOnMap)
        .filter(([, qty]) => qty > 0)
        .map(([addOnId, quantity]) => ({ addOnId, quantity }));

      const estRes = await fetch('/api/estimator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tierId: activeTier.id,
          guestCount,
          selectedAddOns: addOnInputs,
        }),
      });

      const estData = await estRes.json();
      if (!estRes.ok) {
        throw new Error(estData.error || 'Failed to generate estimate record.');
      }

      const invRes = await fetch('/api/invoice/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          estimateId: estData.estimateId,
          contact: {
            name: contactName.trim(),
            phone: contactPhone.trim(),
            email: contactEmail.trim() || undefined,
          },
        }),
      });

      const invData = await invRes.json();
      if (!invRes.ok) {
        throw new Error(invData.error || 'Failed to request draft invoice.');
      }

      setRequestedRef(invData.publicRef);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An error occurred while requesting your invoice.';
      setRequestError(msg);
    } finally {
      setIsRequestingInvoice(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12 min-w-0">
      {/* Page Header */}
      <div className="text-center mb-10 space-y-3">
        <div className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-[var(--text-accent)]">
          <Sparkles className="w-4 h-4 shrink-0" />
          <span>Bespoke Event Catering</span>
        </div>
        <h1 className="font-serif text-3xl md:text-5xl font-bold text-[var(--text-primary)] tracking-tight">
          Catering Cost Estimator
        </h1>
        <p className="text-base md:text-lg text-[var(--text-body-muted)] max-w-2xl mx-auto">
          Instant transparent planning quotes for 20 to 1,000 guests, calculated directly from live kitchen rates.
        </p>
      </div>

      {/* Allergen Notice Banner (single-elevation full border, no thick left bar) */}
      <div className="mb-8 p-4 bg-[var(--status-warning-bg)] border border-[var(--status-warning-border)] rounded-xl flex items-start gap-3 text-sm text-[var(--status-warning-text)]">
        <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold">Important Notice: </span>
          {ALLERGEN_NOTICE}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start min-w-0">
        {/* Left Column: Guest Count, Tiers & Add-ons (7 cols) */}
        <div className="lg:col-span-7 space-y-8 min-w-0">
          {/* 1. Guest Count Slider */}
          <div className="bg-[var(--bg-card)] p-5 sm:p-6 rounded-2xl border border-[var(--border-card)] space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <label
                htmlFor="guest-input"
                className="text-base font-bold text-[var(--text-primary)] flex items-center gap-2"
              >
                <Users className="w-5 h-5 text-[var(--text-accent)] shrink-0" />
                <span>Expected Guest Count</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="guest-input"
                  type="number"
                  min={20}
                  max={1000}
                  value={guestCount}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    if (!isNaN(val)) {
                      setGuestCount(Math.min(1000, Math.max(20, val)));
                    }
                  }}
                  className="w-24 min-h-[44px] px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-card)] focus:border-[var(--border-gold)] rounded-xl text-center font-bold text-[var(--text-primary)] text-base price-tabular focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                />
                <span className="text-sm font-medium text-[var(--text-body-muted)]">guests</span>
              </div>
            </div>

            <div className="min-h-[44px] flex items-center">
              <input
                type="range"
                aria-label="Expected Guest Count Slider"
                min={20}
                max={1000}
                step={5}
                value={guestCount}
                onChange={(e) => setGuestCount(parseInt(e.target.value, 10))}
                className="w-full min-h-[44px] h-11 accent-[#6B1230] cursor-pointer"
              />
            </div>

            <div className="flex flex-wrap justify-between gap-2 text-sm text-[var(--text-body-muted)]">
              <span>20 guests (Intimate)</span>
              <span>150 guests (Standard)</span>
              <span>1,000 guests (Grand Gala)</span>
            </div>
          </div>

          {/* 2. Catering Tiers */}
          <section className="space-y-3">
            <h2 className="text-lg font-serif font-bold text-[var(--text-primary)]">
              1. Select Catering Menu Tier
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {config.tiers.map((tier) => {
                const isSelected = activeTier.id === tier.id;
                const isCompatible =
                  guestCount >= tier.minGuests && guestCount <= tier.maxGuests;

                return (
                  <button
                    key={tier.id}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => {
                      setSelectedTierId(tier.id);
                      if (guestCount < tier.minGuests) setGuestCount(tier.minGuests);
                      if (guestCount > tier.maxGuests) setGuestCount(tier.maxGuests);
                    }}
                    className={`min-h-[44px] w-full text-left p-5 rounded-xl border-2 transition-all cursor-pointer relative ${
                      isSelected
                        ? 'border-[var(--border-gold)] bg-[var(--bg-surface-muted)] shadow-md'
                        : isCompatible
                        ? 'border-[var(--border-subtle-card)] bg-[var(--bg-card)] hover:border-[var(--border-card)]'
                        : 'border-[var(--border-subtle-card)] bg-[var(--bg-card)] opacity-80 hover:border-[var(--border-card)]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-bold text-base text-[var(--text-primary)]">{tier.name}</h3>
                      {isSelected && (
                        <CheckCircle className="w-5 h-5 text-[var(--text-accent)] shrink-0" />
                      )}
                    </div>
                    <p className="text-sm text-[var(--text-body-muted)] mt-1.5 line-clamp-2">
                      {tier.description}
                    </p>
                    <div className="mt-4 pt-3 border-t border-[var(--border-subtle-card)] flex items-baseline justify-between gap-2">
                      <span className="text-base font-extrabold text-[var(--text-accent)] price-tabular">
                        {formatNaira(tier.pricePerGuestKobo)}
                      </span>
                      <span className="text-sm text-[var(--text-body-muted)]">/ guest</span>
                    </div>
                    <div className="text-sm text-[var(--text-body-muted)] mt-1">
                      Designed for {tier.minGuests}–{tier.maxGuests} guests
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* 3. Optional Experience Add-ons */}
          <section className="space-y-3">
            <h2 className="text-lg font-serif font-bold text-[var(--text-primary)]">
              2. Optional Experience Add-ons
            </h2>
            <div className="space-y-3">
              {config.addOns.map((addon) => {
                const isChecked = Boolean(selectedAddOnMap[addon.id]);
                const inputId = `addon-check-${addon.id}`;

                return (
                  <label
                    key={addon.id}
                    htmlFor={inputId}
                    className={`min-h-[44px] flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border transition-all cursor-pointer ${
                      isChecked
                        ? 'border-[var(--border-gold)] bg-[var(--bg-surface-muted)]'
                        : 'border-[var(--border-subtle-card)] bg-[var(--bg-card)] hover:border-[var(--border-card)]'
                    }`}
                  >
                    <div className="flex items-start sm:items-center gap-3 min-w-0">
                      <div className="relative w-11 h-11 shrink-0 flex items-center justify-center">
                        <input
                          id={inputId}
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleAddOn(addon.id)}
                          className="peer appearance-none w-11 h-11 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-card)] checked:bg-[#6B1230] checked:border-[#D4AF37] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                        />
                        <Check
                          aria-hidden="true"
                          className="w-5 h-5 text-[#F7EFD9] pointer-events-none absolute opacity-0 peer-checked:opacity-100 transition-opacity"
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="text-base font-bold text-[var(--text-primary)]">
                          {addon.name}
                        </div>
                        <div className="text-sm text-[var(--text-body-muted)]">
                          {addon.description}
                        </div>
                      </div>
                    </div>
                    <div className="sm:text-right pl-14 sm:pl-0 shrink-0">
                      <div className="text-base font-bold text-[var(--text-accent)] price-tabular">
                        {formatNaira(addon.unitPriceKobo)}
                      </div>
                      <div className="text-sm text-[var(--text-body-muted)]">
                        {addon.pricingModel === 'per_guest' ? 'per guest' : 'flat service'}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </section>
        </div>

        {/* Right Column: Live Cost Breakdown (5 cols) */}
        <div className="lg:col-span-5 lg:sticky lg:top-20 min-w-0">
          <div className="bg-[var(--bg-card)] rounded-2xl border-2 border-[var(--border-card)] shadow-xl overflow-hidden">
            {/* Breakdown Header (Wine header with Cream + Gold Light for >7:1 contrast) */}
            <div className="bg-[#6B1230] text-[#F7EFD9] p-5 border-b border-[#D4AF37]/60">
              <div className="flex items-center gap-2 text-sm text-[#F3D98B] uppercase font-bold tracking-wider">
                <Calculator className="w-4 h-4 shrink-0" />
                <span>Instant Estimate</span>
              </div>
              <h2 className="text-xl font-serif font-bold mt-1 text-[#F7EFD9]">Cost Summary</h2>
              <p className="text-sm text-[#F7EFD9] mt-1">
                {activeTier.name} • {guestCount} Guests
              </p>
            </div>

            {/* Line Items */}
            <div className="p-5 space-y-3.5 text-sm text-[var(--text-primary)]">
              <div className="flex justify-between items-center gap-3">
                <span className="text-[var(--text-body-muted)]">
                  Food ({guestCount} × {formatNaira(activeTier.pricePerGuestKobo)})
                </span>
                <span className="font-semibold price-tabular shrink-0">
                  {formatNaira(estimateResult?.foodSubtotalKobo ?? 0n)}
                </span>
              </div>

              {estimateResult && estimateResult.addOns.length > 0 && (
                <div className="space-y-2 pt-3 border-t border-dashed border-[var(--border-subtle-card)]">
                  <span className="text-sm font-bold uppercase text-[var(--text-body-muted)] block">
                    Selected Add-ons
                  </span>
                  {estimateResult.addOns.map((item) => (
                    <div key={item.addOn.id} className="flex justify-between items-center gap-3 text-sm">
                      <span className="text-[var(--text-body-muted)]">{item.addOn.name}</span>
                      <span className="font-medium price-tabular shrink-0">
                        {formatNaira(item.totalKobo)}
                      </span>
                    </div>
                  ))}
                  <div className="flex justify-between items-center gap-3 text-sm font-semibold pt-1">
                    <span>Add-ons Subtotal</span>
                    <span className="price-tabular shrink-0">
                      {formatNaira(estimateResult.addOnsSubtotalKobo)}
                    </span>
                  </div>
                </div>
              )}

              <div className="flex justify-between items-center gap-3 pt-3 border-t border-[var(--border-subtle-card)]">
                <span className="text-[var(--text-body-muted)]">Logistics &amp; Transport</span>
                <span className="font-semibold price-tabular shrink-0">
                  {formatNaira(estimateResult?.logisticsKobo ?? 0n)}
                </span>
              </div>

              <div className="flex justify-between items-center gap-3">
                <span className="text-[var(--text-body-muted)]">Service Charge (10%)</span>
                <span className="font-semibold price-tabular shrink-0">
                  {formatNaira(estimateResult?.serviceChargeKobo ?? 0n)}
                </span>
              </div>

              {/* Grand Total Wine Bar */}
              <div className="p-4 bg-[#6B1230] text-[#F7EFD9] rounded-xl flex items-center justify-between gap-3 shadow-inner my-2 border border-[#D4AF37]/40">
                <div>
                  <div className="text-sm uppercase tracking-wider text-[#F3D98B] font-bold">
                    ESTIMATED TOTAL
                  </div>
                  <div className="text-sm text-[#F7EFD9]">Inclusive of all items</div>
                </div>
                <div className="text-xl md:text-2xl font-black text-[#FFFFFF] price-tabular shrink-0">
                  {formatNaira(estimateResult?.grandTotalKobo ?? 0n)}
                </div>
              </div>

              {/* 70/30 Policy Deposit Terms */}
              <div className="bg-[var(--bg-surface-muted)] p-3.5 rounded-xl border border-[var(--border-card)] space-y-2 text-sm">
                <div className="flex justify-between gap-3 font-bold text-[var(--text-accent)]">
                  <span>70% Upfront Deposit</span>
                  <span className="price-tabular shrink-0">
                    {formatNaira(estimateResult?.depositKobo ?? 0n)}
                  </span>
                </div>
                <div className="flex justify-between gap-3 text-[var(--text-body-muted)]">
                  <span>30% Balance on Delivery</span>
                  <span className="price-tabular shrink-0">
                    {formatNaira(estimateResult?.balanceKobo ?? 0n)}
                  </span>
                </div>
              </div>

              {/* Phase 1D: Request Official Invoice & WhatsApp Handoff */}
              <div className="pt-3 border-t border-[var(--border-subtle-card)] space-y-3">
                {requestedRef ? (
                  <div className="p-4 bg-[var(--status-success-bg)] border border-[var(--status-success-border)] rounded-xl space-y-3 text-center">
                    <div className="text-sm font-bold text-[var(--status-success-text)]">
                      Request sent. Reference {requestedRef}
                    </div>
                    <p className="text-sm text-[var(--status-success-text)]">
                      Your draft invoice has been submitted to Chef Esther for review. You can message her directly on WhatsApp:
                    </p>
                    <a
                      href={`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
                        `Reference: ${requestedRef}, Guests: ${guestCount}, Review: ${typeof window !== 'undefined' ? window.location.origin : 'https://rockucfoods.com'}/admin/invoices/${requestedRef}`
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full min-h-[48px] py-3 px-4 bg-[#166534] hover:bg-[#14532D] text-[#FFFFFF] font-bold text-sm rounded-xl flex items-center justify-center gap-2 shadow transition-colors"
                    >
                      <span>Message Chef Esther on WhatsApp</span>
                      <ExternalLink className="w-4 h-4 shrink-0" />
                    </a>
                  </div>
                ) : (
                  <form onSubmit={handleRequestInvoice} className="space-y-3 text-sm">
                    <h3 className="font-bold text-base text-[var(--text-primary)]">
                      Request Official Invoice (Draft)
                    </h3>

                    <div>
                      <label htmlFor="est-contact-name" className="block text-sm font-medium text-[var(--text-body-muted)] mb-1">
                        Full Name *
                      </label>
                      <input
                        id="est-contact-name"
                        type="text"
                        required
                        placeholder="Your Full Name"
                        value={contactName}
                        onChange={(e) => setContactName(e.target.value)}
                        className="w-full min-h-[44px] px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-card)] rounded-lg text-base sm:text-sm text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none focus:border-[var(--border-gold)]"
                      />
                    </div>

                    <div>
                      <label htmlFor="est-contact-phone" className="block text-sm font-medium text-[var(--text-body-muted)] mb-1">
                        Phone Number *
                      </label>
                      <input
                        id="est-contact-phone"
                        type="tel"
                        required
                        placeholder="08033729125 or +234..."
                        value={contactPhone}
                        onChange={(e) => setContactPhone(e.target.value)}
                        className="w-full min-h-[44px] px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-card)] rounded-lg text-base sm:text-sm text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none focus:border-[var(--border-gold)]"
                      />
                    </div>

                    <div>
                      <label htmlFor="est-contact-email" className="block text-sm font-medium text-[var(--text-body-muted)] mb-1">
                        Email Address (Optional)
                      </label>
                      <input
                        id="est-contact-email"
                        type="email"
                        placeholder="you@example.com"
                        value={contactEmail}
                        onChange={(e) => setContactEmail(e.target.value)}
                        className="w-full min-h-[44px] px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-card)] rounded-lg text-base sm:text-sm text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none focus:border-[var(--border-gold)]"
                      />
                    </div>

                    {requestError && (
                      <div
                        role="alert"
                        className="p-3 bg-[var(--status-danger-bg)] border border-[var(--status-danger-border)] rounded-lg text-[var(--status-danger-text)] text-sm font-medium"
                      >
                        {requestError}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={isRequestingInvoice || !estimateResult}
                      className={`w-full min-h-[48px] py-3 px-4 font-bold text-sm rounded-xl flex items-center justify-center gap-2 shadow-lg transition-colors border border-[#D4AF37]/60 ${
                        isRequestingInvoice || !estimateResult
                          ? 'bg-[var(--bg-surface-muted)] text-[var(--text-body-muted)] cursor-not-allowed'
                          : 'bg-[#6B1230] hover:bg-[#82173B] text-[#F7EFD9]'
                      }`}
                    >
                      <span>{isRequestingInvoice ? 'Requesting...' : 'Request Official Invoice'}</span>
                    </button>
                    <p className="text-sm text-center text-[var(--text-body-muted)]">
                      Submits your quote to Chef Esther for review. Payment instructions are issued only after review.
                    </p>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
