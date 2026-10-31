'use client';

/**
 * ROCK UC FOODS - Public Catering Estimator
 * Playbook v4 Section 20
 */

import React, { useState, useMemo } from 'react';
import {
  Users,
  CheckCircle,
  ExternalLink,
  ShieldAlert,
  Sparkles,
  Calculator,
  ChevronRight,
  Info,
} from 'lucide-react';
import {
  INITIAL_ESTIMATOR_TIERS,
  INITIAL_ESTIMATOR_ADD_ONS,
  INITIAL_SERVICE_RATES,
} from '../estimator/config';
import { computeEstimate } from '../estimator/compute';
import { formatNaira } from '../lib/money';
import { BUSINESS_CONTACT, ALLERGEN_NOTICE } from '../policy/content';

export function EstimatorClient() {
  const [guestCount, setGuestCount] = useState<number>(100);
  const [selectedTierId, setSelectedTierId] = useState<string>('tier-silver');
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

  const config = useMemo(() => {
    return {
      id: 'default',
      version: 1,
      tiers: INITIAL_ESTIMATOR_TIERS,
      addOns: INITIAL_ESTIMATOR_ADD_ONS,
      serviceRates: INITIAL_SERVICE_RATES,
      updatedAt: '',
      updatedBy: '',
    };
  }, []);

  // Ensure selected tier is compatible with guest count
  const activeTier = useMemo(() => {
    const tier = config.tiers.find((t) => t.id === selectedTierId);
    if (tier && guestCount >= tier.minGuests && guestCount <= tier.maxGuests) {
      return tier;
    }
    // Auto-select fitting tier
    const fitting = config.tiers.find(
      (t) => guestCount >= t.minGuests && guestCount <= t.maxGuests
    );
    return fitting || config.tiers[0];
  }, [config.tiers, selectedTierId, guestCount]);

  // Compute live estimate
  const estimateResult = useMemo(() => {
    const addOnInputs = Object.entries(selectedAddOnMap)
      .filter(([_, qty]) => qty > 0)
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
    } catch (err: any) {
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
      } else {
        return { ...prev, [addOnId]: 1 };
      }
    });
  };

  // WhatsApp Deep Link with prefilled quote summary
  const whatsappQuoteUrl = useMemo(() => {
    if (!estimateResult) return BUSINESS_CONTACT.whatsappUrl;

    const lines = [
      `Hello Chef Esther, I generated a catering estimate on ROCK UC FOODS:`,
      `• Tier: ${estimateResult.tier.name} (${formatNaira(estimateResult.tier.pricePerGuestKobo)}/guest)`,
      `• Guest Count: ${estimateResult.guestCount} guests`,
      `• Food Subtotal: ${formatNaira(estimateResult.foodSubtotalKobo)}`,
      `• Add-ons Subtotal: ${formatNaira(estimateResult.addOnsSubtotalKobo)}`,
      `• Logistics & Delivery: ${formatNaira(estimateResult.logisticsKobo)}`,
      `• Service Charge (10%): ${formatNaira(estimateResult.serviceChargeKobo)}`,
      `• ESTIMATED TOTAL: ${formatNaira(estimateResult.grandTotalKobo)}`,
      `• 70% Upfront Deposit: ${formatNaira(estimateResult.depositKobo)}`,
      `• 30% Balance on Delivery: ${formatNaira(estimateResult.balanceKobo)}`,
      ``,
      `Please review and share an official invoice!`,
    ];

    const encoded = encodeURIComponent(lines.join('\n'));
    return `https://wa.me/2348033729125?text=${encoded}`;
  }, [estimateResult]);

  const handleRequestInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!estimateResult || isRequestingInvoice) return;
    setIsRequestingInvoice(true);
    setRequestError(null);

    try {
      const addOnInputs = Object.entries(selectedAddOnMap)
        .filter(([_, qty]) => qty > 0)
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
    } catch (err: any) {
      setRequestError(err.message || 'An error occurred while requesting your invoice.');
    } finally {
      setIsRequestingInvoice(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      {/* Page Header */}
      <div className="text-center mb-12">
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-[#6B1230]/20 border border-[#D4AF37] text-xs font-semibold text-[#D4AF37] mb-4">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Bespoke Event Catering</span>
        </div>
        <h1 className="text-3xl md:text-5xl font-extrabold text-[#0B0A09] tracking-tight">
          Catering Cost Estimator
        </h1>
        <p className="mt-3 text-base md:text-lg text-[#5A504B] max-w-2xl mx-auto">
          Instant transparent planning quotes for 20 to 1,000 guests. Calculated with strict integer kobo precision.
        </p>
      </div>

      {/* Allergen Notice Banner */}
      <div className="mb-8 p-4 bg-[#F7EFD9] border-l-4 border-[#D4AF37] rounded-r-lg flex items-start space-x-3 text-xs md:text-sm text-[#0B0A09]">
        <ShieldAlert className="w-5 h-5 text-[#6B1230] shrink-0 mt-0.5" />
        <div>
          <span className="font-bold">Important Notice: </span>
          {ALLERGEN_NOTICE}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Guest Count, Tiers & Add-ons (7 cols) */}
        <div className="lg:col-span-7 space-y-8">
          {/* 1. Guest Count Slider */}
          <div className="bg-[#FFFFFF] p-6 rounded-2xl border border-[#E5E0D8] shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <label htmlFor="guest-input" className="text-sm font-bold text-[#0B0A09] flex items-center space-x-2">
                <Users className="w-4 h-4 text-[#6B1230]" />
                <span>Expected Guest Count</span>
              </label>
              <div className="flex items-center space-x-2">
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
                  className="w-20 px-3 py-1.5 border border-[#D4AF37] rounded-lg text-center font-bold text-[#6B1230] text-sm focus:outline-none"
                />
                <span className="text-xs text-[#5A504B]">guests</span>
              </div>
            </div>

            <input
              type="range"
              min={20}
              max={1000}
              step={5}
              value={guestCount}
              onChange={(e) => setGuestCount(parseInt(e.target.value, 10))}
              className="w-full accent-[#6B1230] cursor-pointer"
            />
            <div className="flex justify-between text-[11px] text-[#5A504B] mt-2">
              <span>20 guests (Intimate)</span>
              <span>150 guests (Standard)</span>
              <span>1,000 guests (Grand Gala)</span>
            </div>
          </div>

          {/* 2. Catering Tiers */}
          <div>
            <h3 className="text-base font-bold text-[#0B0A09] mb-3">
              1. Select Catering Menu Tier
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {config.tiers.map((tier) => {
                const isSelected = activeTier.id === tier.id;
                const isCompatible =
                  guestCount >= tier.minGuests && guestCount <= tier.maxGuests;

                return (
                  <div
                    key={tier.id}
                    onClick={() => {
                      setSelectedTierId(tier.id);
                      if (guestCount < tier.minGuests) setGuestCount(tier.minGuests);
                      if (guestCount > tier.maxGuests) setGuestCount(tier.maxGuests);
                    }}
                    className={`p-5 rounded-xl border-2 transition-all cursor-pointer relative ${
                      isSelected
                        ? 'border-[#6B1230] bg-[#FFFBF0] shadow-md'
                        : isCompatible
                        ? 'border-[#E5E0D8] bg-[#FFFFFF] hover:border-[#D4AF37]'
                        : 'border-[#E5E0D8]/60 bg-[#FAFAFA] opacity-75'
                    }`}
                  >
                    {isSelected && (
                      <span className="absolute top-3 right-3 flex items-center text-[#6B1230]">
                        <CheckCircle className="w-5 h-5 fill-[#6B1230] text-[#FFFFFF]" />
                      </span>
                    )}
                    <h4 className="font-bold text-sm text-[#0B0A09]">{tier.name}</h4>
                    <p className="text-xs text-[#5A504B] mt-1 line-clamp-2">
                      {tier.description}
                    </p>
                    <div className="mt-4 pt-3 border-t border-[#E5E0D8] flex items-baseline justify-between">
                      <span className="text-base font-extrabold text-[#6B1230]">
                        {formatNaira(tier.pricePerGuestKobo)}
                      </span>
                      <span className="text-[11px] text-[#5A504B]">/ guest</span>
                    </div>
                    <div className="text-[10px] text-stone-500 mt-1">
                      Designed for {tier.minGuests}–{tier.maxGuests} guests
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 3. Optional Experience Add-ons */}
          <div>
            <h3 className="text-base font-bold text-[#0B0A09] mb-3">
              2. Optional Experience Add-ons
            </h3>
            <div className="space-y-3">
              {config.addOns.map((addon) => {
                const isChecked = Boolean(selectedAddOnMap[addon.id]);

                return (
                  <label
                    key={addon.id}
                    className={`flex items-center justify-between p-4 rounded-xl border transition-all cursor-pointer ${
                      isChecked
                        ? 'border-[#D4AF37] bg-[#FFFBF0]'
                        : 'border-[#E5E0D8] bg-[#FFFFFF] hover:border-stone-300'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleAddOn(addon.id)}
                        className="w-4 h-4 accent-[#6B1230] rounded cursor-pointer"
                      />
                      <div>
                        <div className="text-sm font-bold text-[#0B0A09]">
                          {addon.name}
                        </div>
                        <div className="text-xs text-[#5A504B]">
                          {addon.description}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-[#6B1230]">
                        {formatNaira(addon.unitPriceKobo)}
                      </div>
                      <div className="text-[10px] text-stone-500">
                        {addon.pricingModel === 'per_guest' ? 'per guest' : 'flat service'}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Live Cost Breakdown (5 cols) */}
        <div className="lg:col-span-5 sticky top-6">
          <div className="bg-[#FFFFFF] rounded-2xl border-2 border-[#D4AF37] shadow-xl overflow-hidden">
            {/* Breakdown Header */}
            <div className="bg-[#6B1230] text-[#FFFFFF] p-5 border-b border-[#D4AF37]">
              <div className="flex items-center space-x-2 text-xs text-[#D4AF37] uppercase font-bold tracking-wider">
                <Calculator className="w-4 h-4" />
                <span>Instant Estimate</span>
              </div>
              <h3 className="text-xl font-bold mt-1">Cost Summary</h3>
              <p className="text-xs text-[#F7EFD9]/80 mt-1">
                {activeTier.name} • {guestCount} Guests
              </p>
            </div>

            {/* Line Items */}
            <div className="p-5 space-y-3.5 text-sm text-[#0B0A09]">
              <div className="flex justify-between items-center">
                <span className="text-[#5A504B]">Food ({guestCount} × {formatNaira(activeTier.pricePerGuestKobo)})</span>
                <span className="font-semibold">{formatNaira(estimateResult?.foodSubtotalKobo ?? 0n)}</span>
              </div>

              {estimateResult && estimateResult.addOns.length > 0 && (
                <div className="space-y-1.5 pt-2 border-t border-dashed border-[#E5E0D8]">
                  <span className="text-xs font-bold uppercase text-[#5A504B]">Selected Add-ons</span>
                  {estimateResult.addOns.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center text-xs">
                      <span className="text-[#5A504B]">{item.addOn.name}</span>
                      <span className="font-medium">{formatNaira(item.totalKobo)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between items-center text-xs font-semibold pt-1">
                    <span>Add-ons Subtotal</span>
                    <span>{formatNaira(estimateResult.addOnsSubtotalKobo)}</span>
                  </div>
                </div>
              )}

              <div className="flex justify-between items-center pt-2 border-t border-[#E5E0D8]">
                <span className="text-[#5A504B]">Logistics &amp; Transport</span>
                <span className="font-semibold">{formatNaira(estimateResult?.logisticsKobo ?? 0n)}</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-[#5A504B]">Service Charge (10%)</span>
                <span className="font-semibold">{formatNaira(estimateResult?.serviceChargeKobo ?? 0n)}</span>
              </div>

              {/* Grand Total Wine Bar */}
              <div className="p-4 bg-[#6B1230] text-[#FFFFFF] rounded-xl flex items-center justify-between shadow-inner my-2">
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-[#D4AF37] font-bold">
                    ESTIMATED TOTAL
                  </div>
                  <div className="text-xs text-[#F7EFD9]/80">Inclusive of all items</div>
                </div>
                <div className="text-xl md:text-2xl font-black text-[#FFFFFF]">
                  {formatNaira(estimateResult?.grandTotalKobo ?? 0n)}
                </div>
              </div>

              {/* 70/30 Policy Deposit Terms */}
              <div className="bg-[#FFFBF0] p-3 rounded-lg border border-[#D4AF37]/40 space-y-2 text-xs">
                <div className="flex justify-between font-bold text-[#6B1230]">
                  <span>70% Upfront Deposit</span>
                  <span>{formatNaira(estimateResult?.depositKobo ?? 0n)}</span>
                </div>
                <div className="flex justify-between text-[#5A504B]">
                  <span>30% Balance on Delivery</span>
                  <span>{formatNaira(estimateResult?.balanceKobo ?? 0n)}</span>
                </div>
              </div>

              {/* Phase 1D: Request Official Invoice & WhatsApp Handoff */}
              <div className="pt-3 border-t border-[#E5E0D8] space-y-3">
                {requestedRef ? (
                  <div className="p-4 bg-emerald-50 border border-emerald-500/50 rounded-xl space-y-3 text-center">
                    <div className="text-xs font-bold text-emerald-800">
                      Request sent. Reference {requestedRef}
                    </div>
                    <p className="text-[11px] text-emerald-700">
                      Your draft invoice has been submitted to Chef Esther for review. You can message her directly on WhatsApp:
                    </p>
                    <a
                      href={`https://wa.me/2348033729125?text=${encodeURIComponent(
                        `Hello Chef Esther, I requested an official invoice. Reference: ${requestedRef}, Guests: ${guestCount}`
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-3 px-4 bg-[#1E7E34] hover:bg-[#155724] text-white font-bold text-xs rounded-xl flex items-center justify-center space-x-2 shadow transition-colors"
                    >
                      <span>Message Chef Esther on WhatsApp</span>
                      <ExternalLink className="w-4 h-4 ml-1" />
                    </a>
                  </div>
                ) : (
                  <form onSubmit={handleRequestInvoice} className="space-y-2.5 text-xs">
                    <span className="font-bold text-[#0B0A09] block">
                      Request Official Invoice (Draft)
                    </span>
                    <input
                      type="text"
                      required
                      placeholder="Your Full Name *"
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                      className="w-full px-3 py-2 border border-[#E5E0D8] rounded-lg text-[#0B0A09] focus:outline-none focus:border-[#6B1230]"
                    />
                    <input
                      type="tel"
                      required
                      placeholder="Phone (e.g. 08033729125 or +234...) *"
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      className="w-full px-3 py-2 border border-[#E5E0D8] rounded-lg text-[#0B0A09] focus:outline-none focus:border-[#6B1230]"
                    />
                    <input
                      type="email"
                      placeholder="Email Address (Optional)"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      className="w-full px-3 py-2 border border-[#E5E0D8] rounded-lg text-[#0B0A09] focus:outline-none focus:border-[#6B1230]"
                    />

                    {requestError && (
                      <div className="p-2 bg-rose-50 border border-rose-300 rounded text-rose-700 text-[11px]">
                        {requestError}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={isRequestingInvoice || !estimateResult}
                      className={`w-full py-3 px-4 font-bold text-xs rounded-xl flex items-center justify-center space-x-2 shadow-lg transition-colors ${
                        isRequestingInvoice || !estimateResult
                          ? 'bg-stone-300 text-stone-500 cursor-not-allowed'
                          : 'bg-[#6B1230] hover:bg-[#85163C] text-white'
                      }`}
                    >
                      <span>{isRequestingInvoice ? 'Requesting...' : 'Request Official Invoice'}</span>
                    </button>
                    <p className="text-[10px] text-center text-[#5A504B]">
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
