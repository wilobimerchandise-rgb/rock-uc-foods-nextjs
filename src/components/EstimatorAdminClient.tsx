'use client';

/**
 * ROCK UC FOODS - Catering Estimator Owner Editor Client
 * Playbook v4 Section 20
 * 
 * Rules:
 * - Direct editing of catering tiers, add-ons, and service rates.
 * - Displays in Naira, converts safely to integer BigInt kobo.
 * - Enforces optimistic concurrency using current version.
 * - Clear 409 conflict handling.
 */

import React, { useState, useEffect } from 'react';
import {
  Save,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Plus,
  Trash2,
  Lock,
  DollarSign,
  Layers,
  Settings,
} from 'lucide-react';
import { EstimatorConfigJson } from '../estimator/types';
import { formatNaira, parseNairaToKobo } from '../lib/money';

export function EstimatorAdminClient() {
  const [config, setConfig] = useState<EstimatorConfigJson | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const fetchConfig = async () => {
    setLoading(true);
    setStatusMessage(null);
    try {
      const res = await fetch('/api/estimator');
      const data = await res.json();
      if (res.ok) {
        setConfig(data.config);
      } else {
        setStatusMessage({ type: 'error', text: data.error || 'Failed to load configuration.' });
      }
    } catch {
      setStatusMessage({ type: 'error', text: 'Network error fetching configuration.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const handleTierChange = (index: number, field: string, value: any) => {
    if (!config) return;
    const updatedTiers = [...config.tiers];
    updatedTiers[index] = { ...updatedTiers[index], [field]: value };
    setConfig({ ...config, tiers: updatedTiers });
  };

  const handleAddOnChange = (index: number, field: string, value: any) => {
    if (!config) return;
    const updatedAddOns = [...config.addOns];
    updatedAddOns[index] = { ...updatedAddOns[index], [field]: value };
    setConfig({ ...config, addOns: updatedAddOns });
  };

  const handleServiceRateChange = (field: string, value: any) => {
    if (!config) return;
    setConfig({
      ...config,
      serviceRates: { ...config.serviceRates, [field]: value },
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config || saving) return;

    setSaving(true);
    setStatusMessage(null);

    try {
      const res = await fetch('/api/estimator', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expectedVersion: config.version,
          updatedBy: 'owner@rockucfoods.com',
          tiers: config.tiers,
          addOns: config.addOns,
          serviceRates: config.serviceRates,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setConfig(data.config);
        setStatusMessage({
          type: 'success',
          text: `Catering estimator settings updated successfully (Version ${data.config.version}).`,
        });
      } else if (res.status === 409) {
        setStatusMessage({
          type: 'error',
          text: 'Conflict detected: Another admin updated these settings. Please reload and try again.',
        });
      } else {
        setStatusMessage({
          type: 'error',
          text: data.error || 'Failed to save settings.',
        });
      }
    } catch {
      setStatusMessage({ type: 'error', text: 'Network error saving settings.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex items-center space-x-2 text-[#6B1230]">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span className="font-semibold text-sm">Loading Catering Estimator Config...</span>
        </div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600 font-bold">Failed to load configuration.</p>
        <button
          onClick={fetchConfig}
          className="mt-4 px-4 py-2 bg-[#6B1230] text-white rounded-lg text-sm font-semibold"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 mb-6 border-b border-[#E5E0D8] gap-4">
        <div>
          <div className="flex items-center space-x-2 text-xs font-bold text-[#6B1230] uppercase tracking-wider mb-1">
            <Lock className="w-3.5 h-3.5" />
            <span>Owner Administration</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-[#0B0A09]">
            Catering Estimator Settings
          </h1>
          <p className="text-xs text-[#5A504B] mt-1">
            Adjust live per-guest tier pricing, add-ons, and service charges.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <div className="px-3 py-1 bg-stone-100 rounded-full border border-stone-300 text-xs text-stone-700 font-semibold">
            Config Version: {config.version}
          </div>
          <button
            type="button"
            onClick={fetchConfig}
            disabled={saving}
            className="p-2 border border-stone-300 rounded-lg hover:bg-stone-50 text-stone-700"
            title="Reload from database"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center space-x-2 px-5 py-2.5 bg-[#6B1230] hover:bg-[#85163c] text-white rounded-lg text-sm font-bold shadow-md disabled:opacity-50 transition-colors"
          >
            {saving ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4 text-[#D4AF37]" />
            )}
            <span>Save Changes</span>
          </button>
        </div>
      </div>

      {/* Status Banner */}
      {statusMessage && (
        <div
          className={`mb-6 p-4 rounded-xl flex items-center space-x-3 text-sm font-semibold ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
              : 'bg-rose-50 text-rose-800 border border-rose-300'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-8">
        {/* Section 1: Service Rates */}
        <div className="bg-white p-6 rounded-2xl border border-[#E5E0D8] shadow-sm">
          <div className="flex items-center space-x-2 text-base font-bold text-[#0B0A09] mb-4">
            <Settings className="w-5 h-5 text-[#6B1230]" />
            <span>Service Rates &amp; Logistics</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                Service Charge (%)
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="30"
                  value={config.serviceRates.serviceChargeBps / 100}
                  onChange={(e) =>
                    handleServiceRateChange(
                      'serviceChargeBps',
                      Math.round(parseFloat(e.target.value || '0') * 100)
                    )
                  }
                  className="w-full px-3 py-2 border rounded-lg text-sm font-semibold focus:outline-none focus:border-[#6B1230]"
                />
                <span className="text-xs text-stone-500 font-bold">%</span>
              </div>
              <p className="text-[11px] text-stone-500 mt-1">Default 10.0% (1,000 bps)</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                Base Logistics (Kobo)
              </label>
              <input
                type="number"
                min="0"
                step="100000"
                value={config.serviceRates.baseLogisticsKobo}
                onChange={(e) =>
                  handleServiceRateChange('baseLogisticsKobo', e.target.value)
                }
                className="w-full px-3 py-2 border rounded-lg text-sm font-semibold focus:outline-none focus:border-[#6B1230]"
              />
              <p className="text-[11px] text-stone-500 mt-1">
                Current: {formatNaira(BigInt(config.serviceRates.baseLogisticsKobo || '0'))}
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                Min Deposit (%)
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="number"
                  step="5"
                  min="50"
                  max="100"
                  value={config.serviceRates.minDepositBps / 100}
                  onChange={(e) =>
                    handleServiceRateChange(
                      'minDepositBps',
                      Math.round(parseFloat(e.target.value || '0') * 100)
                    )
                  }
                  className="w-full px-3 py-2 border rounded-lg text-sm font-semibold focus:outline-none focus:border-[#6B1230]"
                />
                <span className="text-xs text-stone-500 font-bold">%</span>
              </div>
              <p className="text-[11px] text-stone-500 mt-1">Playbook rule: 70% upfront</p>
            </div>
          </div>
        </div>

        {/* Section 2: Catering Tiers */}
        <div className="bg-white p-6 rounded-2xl border border-[#E5E0D8] shadow-sm">
          <div className="flex items-center space-x-2 text-base font-bold text-[#0B0A09] mb-4">
            <Layers className="w-5 h-5 text-[#6B1230]" />
            <span>Catering Menu Tiers</span>
          </div>

          <div className="space-y-4">
            {config.tiers.map((tier, idx) => (
              <div
                key={tier.id}
                className="p-4 border rounded-xl bg-stone-50/50 space-y-3"
              >
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                  <div className="md:col-span-3">
                    <label className="block text-[11px] font-bold text-stone-600 mb-0.5">
                      Tier Name
                    </label>
                    <input
                      type="text"
                      value={tier.name}
                      onChange={(e) => handleTierChange(idx, 'name', e.target.value)}
                      className="w-full px-3 py-1.5 border rounded-lg text-xs font-bold bg-white"
                    />
                  </div>

                  <div className="md:col-span-3">
                    <label className="block text-[11px] font-bold text-stone-600 mb-0.5">
                      Price/Guest (Kobo)
                    </label>
                    <input
                      type="number"
                      step="50000"
                      min="100000"
                      value={tier.pricePerGuestKobo}
                      onChange={(e) =>
                        handleTierChange(idx, 'pricePerGuestKobo', e.target.value)
                      }
                      className="w-full px-3 py-1.5 border rounded-lg text-xs font-bold text-[#6B1230] bg-white"
                    />
                    <div className="text-[10px] text-stone-500 mt-0.5">
                      {formatNaira(BigInt(tier.pricePerGuestKobo || '0'))} / guest
                    </div>
                  </div>

                  <div className="md:col-span-3 flex space-x-2">
                    <div className="w-1/2">
                      <label className="block text-[11px] font-bold text-stone-600 mb-0.5">
                        Min Guests
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={tier.minGuests}
                        onChange={(e) =>
                          handleTierChange(idx, 'minGuests', parseInt(e.target.value, 10))
                        }
                        className="w-full px-2 py-1.5 border rounded-lg text-xs text-center bg-white"
                      />
                    </div>
                    <div className="w-1/2">
                      <label className="block text-[11px] font-bold text-stone-600 mb-0.5">
                        Max Guests
                      </label>
                      <input
                        type="number"
                        min={tier.minGuests}
                        value={tier.maxGuests}
                        onChange={(e) =>
                          handleTierChange(idx, 'maxGuests', parseInt(e.target.value, 10))
                        }
                        className="w-full px-2 py-1.5 border rounded-lg text-xs text-center bg-white"
                      />
                    </div>
                  </div>

                  <div className="md:col-span-3">
                    <label className="block text-[11px] font-bold text-stone-600 mb-0.5">
                      Description
                    </label>
                    <input
                      type="text"
                      value={tier.description}
                      onChange={(e) => handleTierChange(idx, 'description', e.target.value)}
                      className="w-full px-3 py-1.5 border rounded-lg text-xs bg-white"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Section 3: Add-ons */}
        <div className="bg-white p-6 rounded-2xl border border-[#E5E0D8] shadow-sm">
          <div className="flex items-center space-x-2 text-base font-bold text-[#0B0A09] mb-4">
            <DollarSign className="w-5 h-5 text-[#6B1230]" />
            <span>Optional Experience Add-ons</span>
          </div>

          <div className="space-y-4">
            {config.addOns.map((addon, idx) => (
              <div
                key={addon.id}
                className="p-4 border rounded-xl bg-stone-50/50 space-y-3"
              >
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                  <div className="md:col-span-3">
                    <label className="block text-[11px] font-bold text-stone-600 mb-0.5">
                      Add-on Name
                    </label>
                    <input
                      type="text"
                      value={addon.name}
                      onChange={(e) => handleAddOnChange(idx, 'name', e.target.value)}
                      className="w-full px-3 py-1.5 border rounded-lg text-xs font-bold bg-white"
                    />
                  </div>

                  <div className="md:col-span-3">
                    <label className="block text-[11px] font-bold text-stone-600 mb-0.5">
                      Unit Price (Kobo)
                    </label>
                    <input
                      type="number"
                      step="50000"
                      min="0"
                      value={addon.unitPriceKobo}
                      onChange={(e) =>
                        handleAddOnChange(idx, 'unitPriceKobo', e.target.value)
                      }
                      className="w-full px-3 py-1.5 border rounded-lg text-xs font-bold text-[#6B1230] bg-white"
                    />
                    <div className="text-[10px] text-stone-500 mt-0.5">
                      {formatNaira(BigInt(addon.unitPriceKobo || '0'))}
                    </div>
                  </div>

                  <div className="md:col-span-3">
                    <label className="block text-[11px] font-bold text-stone-600 mb-0.5">
                      Pricing Model
                    </label>
                    <select
                      value={addon.pricingModel}
                      onChange={(e) =>
                        handleAddOnChange(idx, 'pricingModel', e.target.value)
                      }
                      className="w-full px-3 py-1.5 border rounded-lg text-xs bg-white font-semibold"
                    >
                      <option value="per_guest">Per Guest (× Guest Count)</option>
                      <option value="flat">Flat Rate</option>
                    </select>
                  </div>

                  <div className="md:col-span-3">
                    <label className="block text-[11px] font-bold text-stone-600 mb-0.5">
                      Description
                    </label>
                    <input
                      type="text"
                      value={addon.description}
                      onChange={(e) =>
                        handleAddOnChange(idx, 'description', e.target.value)
                      }
                      className="w-full px-3 py-1.5 border rounded-lg text-xs bg-white"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </form>
    </div>
  );
}
