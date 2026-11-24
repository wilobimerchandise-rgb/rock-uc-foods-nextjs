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
  Lock,
  DollarSign,
  Layers,
  Settings,
} from 'lucide-react';
import { EstimatorConfigJson } from '../estimator/types';
import { formatNaira } from '../lib/money';

function safeFormatKobo(raw?: string): string {
  if (!raw || !/^\d+$/.test(raw.trim())) {
    return '₦0.00';
  }
  try {
    return formatNaira(BigInt(raw.trim()));
  } catch {
    return '₦0.00';
  }
}

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
    let ignore = false;
    fetch('/api/estimator')
      .then((res) => res.json())
      .then((data) => {
        if (!ignore) {
          if (data.config) setConfig(data.config);
          else setStatusMessage({ type: 'error', text: data.error || 'Failed to load configuration.' });
        }
      })
      .catch(() => {
        if (!ignore) setStatusMessage({ type: 'error', text: 'Network error fetching configuration.' });
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, []);

  const handleTierChange = (index: number, field: string, value: string | number) => {
    if (!config) return;
    const updatedTiers = [...config.tiers];
    updatedTiers[index] = { ...updatedTiers[index], [field]: value };
    setConfig({ ...config, tiers: updatedTiers });
  };

  const handleAddOnChange = (index: number, field: string, value: string | number) => {
    if (!config) return;
    const updatedAddOns = [...config.addOns];
    updatedAddOns[index] = { ...updatedAddOns[index], [field]: value };
    setConfig({ ...config, addOns: updatedAddOns });
  };

  const handleServiceRateChange = (field: string, value: string | number) => {
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
      <div className="flex items-center justify-center min-h-[320px]">
        <div className="flex items-center gap-2 text-[var(--text-accent)]">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span className="font-semibold text-sm">Loading Catering Estimator Config...</span>
        </div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="p-8 text-center space-y-4">
        <p role="alert" className="text-[var(--status-danger-text)] font-bold text-sm">
          Failed to load configuration.
        </p>
        <button
          type="button"
          onClick={fetchConfig}
          className="min-h-[44px] px-5 py-2.5 bg-[#6B1230] text-[#F7EFD9] border border-[#D4AF37]/60 rounded-xl text-sm font-semibold"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-2 sm:px-4 py-4 sm:py-6 min-w-0">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 mb-6 border-b border-[var(--border-card)] gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm font-bold text-[var(--text-accent)] uppercase tracking-wider mb-1">
            <Lock className="w-4 h-4 shrink-0" />
            <span>Owner Administration</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-serif font-bold text-[var(--text-primary)]">
            Catering Estimator Settings
          </h1>
          <p className="text-sm text-[var(--text-body-muted)] mt-1">
            Adjust live per-guest tier pricing, add-ons, and service charges.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="min-h-[44px] inline-flex items-center px-3.5 py-2 bg-[var(--bg-card)] rounded-lg border border-[var(--border-card)] text-sm text-[var(--text-primary)] font-semibold price-tabular">
            Config Version: {config.version}
          </div>
          <button
            type="button"
            onClick={fetchConfig}
            disabled={saving}
            aria-label="Reload configuration from database"
            className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center border border-[var(--border-card)] rounded-lg bg-[var(--bg-card)] hover:border-[var(--border-gold)] text-[var(--text-primary)]"
            title="Reload from database"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="min-h-[44px] flex items-center gap-2 px-5 py-2.5 bg-[#6B1230] hover:bg-[#82173B] text-[#F7EFD9] border border-[#D4AF37]/60 rounded-lg text-sm font-bold shadow-md disabled:opacity-50 transition-colors"
          >
            {saving ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4 text-[#F3D98B]" />
            )}
            <span>Save Changes</span>
          </button>
        </div>
      </div>

      {/* Status Banner */}
      {statusMessage && (
        <div
          role={statusMessage.type === 'error' ? 'alert' : 'status'}
          className={`mb-6 p-4 rounded-xl flex items-center gap-3 text-sm font-semibold border ${
            statusMessage.type === 'success'
              ? 'bg-[var(--status-success-bg)] text-[var(--status-success-text)] border-[var(--status-success-border)]'
              : 'bg-[var(--status-danger-bg)] text-[var(--status-danger-text)] border-[var(--status-danger-border)]'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle className="w-5 h-5 shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 shrink-0" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-8">
        {/* Section 1: Service Rates */}
        <section className="bg-[var(--bg-card)] p-5 sm:p-6 rounded-2xl border border-[var(--border-card)] shadow-sm">
          <div className="flex items-center gap-2 text-base font-bold text-[var(--text-primary)] mb-4">
            <Settings className="w-5 h-5 text-[var(--text-accent)] shrink-0" />
            <h2>Service Rates &amp; Logistics</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div>
              <label htmlFor="rate-service-charge" className="block text-sm font-bold text-[var(--text-primary)] mb-1.5">
                Service Charge (%)
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="rate-service-charge"
                  type="number"
                  step="0.5"
                  min="0"
                  max="30"
                  value={(config.serviceRates.serviceChargeBps ?? 0) / 100}
                  onChange={(e) =>
                    handleServiceRateChange(
                      'serviceChargeBps',
                      Math.round(parseFloat(e.target.value || '0') * 100)
                    )
                  }
                  className="w-full min-h-[44px] px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-card)] rounded-lg text-base sm:text-sm font-semibold text-[var(--text-primary)] price-tabular focus:outline-none focus:border-[var(--border-gold)]"
                />
                <span className="text-sm text-[var(--text-body-muted)] font-bold">%</span>
              </div>
              <p className="text-sm text-[var(--text-body-muted)] mt-1">Default 10.0% (1,000 bps)</p>
            </div>

            <div>
              <label htmlFor="rate-base-logistics" className="block text-sm font-bold text-[var(--text-primary)] mb-1.5">
                Base Logistics (Kobo)
              </label>
              <input
                id="rate-base-logistics"
                type="number"
                min="0"
                step="100000"
                value={config.serviceRates.baseLogisticsKobo}
                onChange={(e) =>
                  handleServiceRateChange('baseLogisticsKobo', e.target.value)
                }
                className="w-full min-h-[44px] px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-card)] rounded-lg text-base sm:text-sm font-semibold text-[var(--text-primary)] price-tabular focus:outline-none focus:border-[var(--border-gold)]"
              />
              <p className="text-sm text-[var(--text-body-muted)] mt-1 price-tabular">
                Current: {safeFormatKobo(config.serviceRates.baseLogisticsKobo)}
              </p>
            </div>

            <div>
              <label htmlFor="rate-min-deposit" className="block text-sm font-bold text-[var(--text-primary)] mb-1.5">
                Min Deposit (%)
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="rate-min-deposit"
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
                  className="w-full min-h-[44px] px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-card)] rounded-lg text-base sm:text-sm font-semibold text-[var(--text-primary)] price-tabular focus:outline-none focus:border-[var(--border-gold)]"
                />
                <span className="text-sm text-[var(--text-body-muted)] font-bold">%</span>
              </div>
              <p className="text-sm text-[var(--text-body-muted)] mt-1">Playbook rule: 70% upfront</p>
            </div>
          </div>
        </section>

        {/* Section 2: Catering Tiers */}
        <section className="bg-[var(--bg-card)] p-5 sm:p-6 rounded-2xl border border-[var(--border-card)] shadow-sm">
          <div className="flex items-center gap-2 text-base font-bold text-[var(--text-primary)] mb-4">
            <Layers className="w-5 h-5 text-[var(--text-accent)] shrink-0" />
            <h2>Catering Menu Tiers</h2>
          </div>

          <div className="space-y-4">
            {config.tiers.map((tier, idx) => (
              <div
                key={tier.id}
                className="p-4 border border-[var(--border-subtle-card)] rounded-xl bg-[var(--bg-primary)] space-y-3"
              >
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-start">
                  <div className="md:col-span-3">
                    <label htmlFor={`tier-name-${idx}`} className="block text-sm font-bold text-[var(--text-body-muted)] mb-1">
                      Tier Name
                    </label>
                    <input
                      id={`tier-name-${idx}`}
                      type="text"
                      value={tier.name}
                      onChange={(e) => handleTierChange(idx, 'name', e.target.value)}
                      className="w-full min-h-[44px] px-3 py-2 border border-[var(--border-card)] rounded-lg text-base sm:text-sm font-bold bg-[var(--bg-card)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-gold)]"
                    />
                  </div>

                  <div className="md:col-span-3">
                    <label htmlFor={`tier-price-${idx}`} className="block text-sm font-bold text-[var(--text-body-muted)] mb-1">
                      Price/Guest (Kobo)
                    </label>
                    <input
                      id={`tier-price-${idx}`}
                      type="number"
                      step="50000"
                      min="100000"
                      value={tier.pricePerGuestKobo}
                      onChange={(e) =>
                        handleTierChange(idx, 'pricePerGuestKobo', e.target.value)
                      }
                      className="w-full min-h-[44px] px-3 py-2 border border-[var(--border-card)] rounded-lg text-base sm:text-sm font-bold text-[var(--text-accent)] bg-[var(--bg-card)] price-tabular focus:outline-none focus:border-[var(--border-gold)]"
                    />
                    <div className="text-sm text-[var(--text-body-muted)] mt-1 price-tabular">
                      {safeFormatKobo(tier.pricePerGuestKobo)} / guest
                    </div>
                  </div>

                  <div className="md:col-span-3 flex gap-2">
                    <div className="w-1/2">
                      <label htmlFor={`tier-min-${idx}`} className="block text-sm font-bold text-[var(--text-body-muted)] mb-1">
                        Min Guests
                      </label>
                      <input
                        id={`tier-min-${idx}`}
                        type="number"
                        min="1"
                        value={tier.minGuests}
                        onChange={(e) =>
                          handleTierChange(idx, 'minGuests', parseInt(e.target.value || '1', 10))
                        }
                        className="w-full min-h-[44px] px-2 py-2 border border-[var(--border-card)] rounded-lg text-base sm:text-sm text-center bg-[var(--bg-card)] text-[var(--text-primary)] price-tabular focus:outline-none focus:border-[var(--border-gold)]"
                      />
                    </div>
                    <div className="w-1/2">
                      <label htmlFor={`tier-max-${idx}`} className="block text-sm font-bold text-[var(--text-body-muted)] mb-1">
                        Max Guests
                      </label>
                      <input
                        id={`tier-max-${idx}`}
                        type="number"
                        min={tier.minGuests}
                        value={tier.maxGuests}
                        onChange={(e) =>
                          handleTierChange(idx, 'maxGuests', parseInt(e.target.value || '1', 10))
                        }
                        className="w-full min-h-[44px] px-2 py-2 border border-[var(--border-card)] rounded-lg text-base sm:text-sm text-center bg-[var(--bg-card)] text-[var(--text-primary)] price-tabular focus:outline-none focus:border-[var(--border-gold)]"
                      />
                    </div>
                  </div>

                  <div className="md:col-span-3">
                    <label htmlFor={`tier-desc-${idx}`} className="block text-sm font-bold text-[var(--text-body-muted)] mb-1">
                      Description
                    </label>
                    <input
                      id={`tier-desc-${idx}`}
                      type="text"
                      value={tier.description}
                      onChange={(e) => handleTierChange(idx, 'description', e.target.value)}
                      className="w-full min-h-[44px] px-3 py-2 border border-[var(--border-card)] rounded-lg text-base sm:text-sm bg-[var(--bg-card)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-gold)]"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Section 3: Add-ons */}
        <section className="bg-[var(--bg-card)] p-5 sm:p-6 rounded-2xl border border-[var(--border-card)] shadow-sm">
          <div className="flex items-center gap-2 text-base font-bold text-[var(--text-primary)] mb-4">
            <DollarSign className="w-5 h-5 text-[var(--text-accent)] shrink-0" />
            <h2>Optional Experience Add-ons</h2>
          </div>

          <div className="space-y-4">
            {config.addOns.map((addon, idx) => (
              <div
                key={addon.id}
                className="p-4 border border-[var(--border-subtle-card)] rounded-xl bg-[var(--bg-primary)] space-y-3"
              >
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-start">
                  <div className="md:col-span-3">
                    <label htmlFor={`addon-name-${idx}`} className="block text-sm font-bold text-[var(--text-body-muted)] mb-1">
                      Add-on Name
                    </label>
                    <input
                      id={`addon-name-${idx}`}
                      type="text"
                      value={addon.name}
                      onChange={(e) => handleAddOnChange(idx, 'name', e.target.value)}
                      className="w-full min-h-[44px] px-3 py-2 border border-[var(--border-card)] rounded-lg text-base sm:text-sm font-bold bg-[var(--bg-card)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-gold)]"
                    />
                  </div>

                  <div className="md:col-span-3">
                    <label htmlFor={`addon-price-${idx}`} className="block text-sm font-bold text-[var(--text-body-muted)] mb-1">
                      Unit Price (Kobo)
                    </label>
                    <input
                      id={`addon-price-${idx}`}
                      type="number"
                      step="50000"
                      min="0"
                      value={addon.unitPriceKobo}
                      onChange={(e) =>
                        handleAddOnChange(idx, 'unitPriceKobo', e.target.value)
                      }
                      className="w-full min-h-[44px] px-3 py-2 border border-[var(--border-card)] rounded-lg text-base sm:text-sm font-bold text-[var(--text-accent)] bg-[var(--bg-card)] price-tabular focus:outline-none focus:border-[var(--border-gold)]"
                    />
                    <div className="text-sm text-[var(--text-body-muted)] mt-1 price-tabular">
                      {safeFormatKobo(addon.unitPriceKobo)}
                    </div>
                  </div>

                  <div className="md:col-span-3">
                    <label htmlFor={`addon-model-${idx}`} className="block text-sm font-bold text-[var(--text-body-muted)] mb-1">
                      Pricing Model
                    </label>
                    <select
                      id={`addon-model-${idx}`}
                      value={addon.pricingModel}
                      onChange={(e) =>
                        handleAddOnChange(idx, 'pricingModel', e.target.value)
                      }
                      className="w-full min-h-[44px] px-3 py-2 border border-[var(--border-card)] rounded-lg text-base sm:text-sm bg-[var(--bg-card)] text-[var(--text-primary)] font-semibold focus:outline-none focus:border-[var(--border-gold)]"
                    >
                      <option value="per_guest">Per Guest (× Guest Count)</option>
                      <option value="flat">Flat Rate</option>
                    </select>
                  </div>

                  <div className="md:col-span-3">
                    <label htmlFor={`addon-desc-${idx}`} className="block text-sm font-bold text-[var(--text-body-muted)] mb-1">
                      Description
                    </label>
                    <input
                      id={`addon-desc-${idx}`}
                      type="text"
                      value={addon.description}
                      onChange={(e) =>
                        handleAddOnChange(idx, 'description', e.target.value)
                      }
                      className="w-full min-h-[44px] px-3 py-2 border border-[var(--border-card)] rounded-lg text-base sm:text-sm bg-[var(--bg-card)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-gold)]"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </form>
    </div>
  );
}
