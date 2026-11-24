'use client';

/**
 * ROCK UC FOODS - Lagos Delivery Zone Pricing & Active Status Manager
 * BigInt kobo strictly preserved; owner + verified MFA required for edits.
 * Section 35 compliant across dark & light schemes and all mobile viewports.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { getAllDeliveryZones } from '../../order/deliveryZones';
import { formatNaira } from '../../lib/money';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Lock,
  MapPin,
  RefreshCw,
  Save,
} from 'lucide-react';

export interface SerializedZone {
  id: string;
  code: string;
  name: string;
  areas: string[];
  feeKobo: string;
  feeFormatted: string;
  isActive: boolean;
  sortOrder: number;
}

export interface DeliveryZoneManagerProps {
  currentUserRole: 'owner' | 'staff' | 'developer';
  hasMfaVerified?: boolean;
  initialZones?: SerializedZone[];
}

function koboStrToNairaInput(feeKoboStr: string): string {
  const kobo = BigInt(feeKoboStr || '0');
  const whole = kobo / 100n;
  const rem = kobo % 100n;
  return `${whole.toString()}.${rem.toString().padStart(2, '0')}`;
}

export const DeliveryZoneManager: React.FC<DeliveryZoneManagerProps> = ({
  currentUserRole,
  hasMfaVerified = false,
  initialZones,
}) => {
  const canMutate = currentUserRole === 'owner' && hasMfaVerified;

  const [zones, setZones] = useState<SerializedZone[]>(() => {
    if (initialZones && initialZones.length > 0) return initialZones;
    return getAllDeliveryZones(true).map((z) => ({
      id: z.id,
      code: z.code,
      name: z.name,
      areas: z.areas,
      feeKobo: z.feeKobo.toString(),
      feeFormatted: formatNaira(z.feeKobo),
      isActive: z.isActive,
      sortOrder: z.sortOrder,
    }));
  });

  const [draftFees, setDraftFees] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    for (const z of zones) out[z.id] = koboStrToNairaInput(z.feeKobo);
    return out;
  });
  const [draftAreas, setDraftAreas] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    for (const z of zones) out[z.id] = z.areas.join(', ');
    return out;
  });
  const [draftActive, setDraftActive] = useState<Record<string, boolean>>(() => {
    const out: Record<string, boolean> = {};
    for (const z of zones) out[z.id] = z.isActive;
    return out;
  });
  const [savingZoneId, setSavingZoneId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );

  const syncDraftsFromZones = useCallback((list: SerializedZone[]) => {
    const fees: Record<string, string> = {};
    const areas: Record<string, string> = {};
    const active: Record<string, boolean> = {};
    for (const z of list) {
      fees[z.id] = koboStrToNairaInput(z.feeKobo);
      areas[z.id] = z.areas.join(', ');
      active[z.id] = z.isActive;
    }
    setDraftFees(fees);
    setDraftAreas(areas);
    setDraftActive(active);
  }, []);

  const loadZones = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/delivery-zones', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to load delivery zones.');
      if (Array.isArray(data.zones)) {
        setZones(data.zones);
        syncDraftsFromZones(data.zones);
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Unable to refresh delivery zones.' });
    } finally {
      setLoading(false);
    }
  }, [syncDraftsFromZones]);

  useEffect(() => {
    if (initialZones) return;
    let active = true;
    async function initialFetch() {
      try {
        const res = await fetch('/api/admin/delivery-zones', { cache: 'no-store' });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || 'Failed to load delivery zones.');
        if (!active) return;
        if (Array.isArray(data.zones)) {
          setZones(data.zones);
          syncDraftsFromZones(data.zones);
        }
      } catch (err: any) {
        if (active) {
          setFeedback({ type: 'error', message: err?.message || 'Unable to refresh delivery zones.' });
        }
      }
    }
    void initialFetch();
    return () => {
      active = false;
    };
  }, [initialZones, syncDraftsFromZones]);

  const handleSaveZone = async (zone: SerializedZone) => {
    if (!canMutate) {
      setFeedback({
        type: 'error',
        message: 'Only owner sessions with verified 2FA may modify delivery zone fees or status.',
      });
      return;
    }

    setSavingZoneId(zone.id);
    setFeedback(null);
    try {
      const res = await fetch('/api/admin/delivery-zones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: zone.id,
          feeNaira: draftFees[zone.id] ?? koboStrToNairaInput(zone.feeKobo),
          isActive: draftActive[zone.id] ?? zone.isActive,
          areasCsv: draftAreas[zone.id] ?? zone.areas.join(', '),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data?.error || 'Failed to update delivery zone.');
      }
      if (Array.isArray(data.zones)) {
        setZones(data.zones);
        syncDraftsFromZones(data.zones);
      }
      setFeedback({
        type: 'success',
        message: `Updated ${zone.name} to ${data.zone?.feeFormatted || ''} (${
          data.zone?.isActive ? 'Active' : 'Paused'
        }).`,
      });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Error updating delivery zone.' });
    } finally {
      setSavingZoneId(null);
    }
  };

  return (
    <div
      className="bg-[var(--bg-primary)] text-[var(--text-primary)] p-4 md:p-6 max-w-5xl mx-auto space-y-6 min-w-0 w-full max-w-full"
      data-testid="delivery-zone-manager"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[var(--border-subtle-card)]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-serif font-bold text-[var(--text-primary)]">
              Lagos Delivery Zones &amp; Fees
            </h1>
            <span className="text-sm font-bold uppercase px-2.5 py-0.5 rounded-md bg-[var(--bg-card)] border border-[var(--border-gold)] text-[var(--text-accent)]">
              {zones.filter((z) => z.isActive).length}/{zones.length} Active
            </span>
          </div>
          <p className="text-sm text-[var(--text-body-muted)] mt-1">
            Configure Lagos rider dispatch tariffs in ₦ (stored strictly as integer kobo) and pause or resume zones.
          </p>
        </div>

        <button
          type="button"
          onClick={loadZones}
          disabled={loading}
          className="min-h-[44px] min-w-[44px] bg-[var(--bg-card)] border border-[var(--border-card)] text-[var(--text-primary)] px-4 py-2 rounded-xl text-sm font-semibold hover:border-[var(--border-gold)] inline-flex items-center gap-2 shrink-0"
        >
          <RefreshCw className={`w-4 h-4 text-[var(--text-accent)] shrink-0 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Zones</span>
        </button>
      </div>

      {!canMutate && (
        <div
          role="status"
          className="p-4 rounded-xl bg-[var(--status-warning-bg)] border border-[var(--status-warning-border)] text-[var(--status-warning-text)] text-sm flex items-start gap-3"
        >
          <Lock className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold block">Read-Only Zone Tariffs (Owner + Verified 2FA Required to Edit)</span>
            <span>
              Delivery fees are server-authoritative. Staff may view active Lagos zones and areas for phone orders; Owner + MFA is required to alter tariffs.
            </span>
          </div>
        </div>
      )}

      {feedback && (
        <div
          role={feedback.type === 'error' ? 'alert' : 'status'}
          className={`p-4 rounded-xl text-sm border flex items-center gap-2 font-semibold ${
            feedback.type === 'error'
              ? 'bg-[var(--status-danger-bg)] text-[var(--status-danger-text)] border-[var(--status-danger-border)]'
              : 'bg-[var(--status-success-bg)] text-[var(--status-success-text)] border-[var(--status-success-border)]'
          }`}
        >
          {feedback.type === 'error' ? (
            <AlertTriangle className="w-5 h-5 shrink-0" />
          ) : (
            <CheckCircle2 className="w-5 h-5 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Zone Cards */}
      <div className="space-y-4">
        {zones.map((zone) => {
          const isChecked = draftActive[zone.id] ?? zone.isActive;
          const isSaving = savingZoneId === zone.id;

          return (
            <div
              key={zone.id}
              className="bg-[var(--bg-card)] border border-[var(--border-card)] rounded-2xl p-5 space-y-4"
              data-testid={`delivery-zone-card-${zone.id}`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[var(--border-subtle-card)]">
                <div className="flex flex-wrap items-center gap-2">
                  <MapPin className="w-5 h-5 text-[var(--text-accent)] shrink-0" />
                  <h2 className="text-lg font-serif font-bold text-[var(--text-primary)]">
                    {zone.name}
                  </h2>
                  <span className="text-sm font-mono px-2.5 py-0.5 rounded-md bg-[var(--bg-surface-muted)] border border-[var(--border-subtle-card)] text-[var(--text-accent)]">
                    {zone.code}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`text-sm font-bold uppercase px-2.5 py-0.5 rounded-md border ${
                      zone.isActive
                        ? 'bg-[var(--status-success-bg)] text-[var(--status-success-text)] border-[var(--status-success-border)]'
                        : 'bg-[var(--status-danger-bg)] text-[var(--status-danger-text)] border-[var(--status-danger-border)]'
                    }`}
                  >
                    {zone.isActive ? 'Active' : 'Paused'}
                  </span>
                  <span className="font-mono font-bold text-base text-[var(--text-accent)] price-tabular">
                    {zone.feeFormatted}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                <div className="md:col-span-3">
                  <label
                    htmlFor={`zone-fee-${zone.id}`}
                    className="block text-sm font-semibold text-[var(--text-accent)] mb-1"
                  >
                    Dispatch Fee in ₦
                  </label>
                  <input
                    id={`zone-fee-${zone.id}`}
                    type="text"
                    disabled={!canMutate || isSaving}
                    value={draftFees[zone.id] ?? koboStrToNairaInput(zone.feeKobo)}
                    onChange={(e) =>
                      setDraftFees((prev) => ({ ...prev, [zone.id]: e.target.value }))
                    }
                    className="w-full min-h-[44px] bg-[var(--bg-primary)] border border-[var(--border-card)] rounded-xl px-3.5 py-2 text-sm font-mono price-tabular text-[var(--text-primary)] disabled:opacity-70"
                  />
                </div>

                <div className="md:col-span-5">
                  <label
                    htmlFor={`zone-areas-${zone.id}`}
                    className="block text-sm font-semibold text-[var(--text-accent)] mb-1"
                  >
                    Covered Lagos Areas (comma-separated)
                  </label>
                  <input
                    id={`zone-areas-${zone.id}`}
                    type="text"
                    disabled={!canMutate || isSaving}
                    value={draftAreas[zone.id] ?? zone.areas.join(', ')}
                    onChange={(e) =>
                      setDraftAreas((prev) => ({ ...prev, [zone.id]: e.target.value }))
                    }
                    className="w-full min-h-[44px] bg-[var(--bg-primary)] border border-[var(--border-card)] rounded-xl px-3.5 py-2 text-sm text-[var(--text-primary)] disabled:opacity-70"
                  />
                </div>

                <div className="md:col-span-2 flex items-center">
                  <label
                    htmlFor={`zone-active-${zone.id}`}
                    className="flex items-center gap-2.5 cursor-pointer min-h-[44px]"
                  >
                    <div className="relative w-11 h-11 shrink-0 flex items-center justify-center">
                      <input
                        id={`zone-active-${zone.id}`}
                        type="checkbox"
                        disabled={!canMutate || isSaving}
                        checked={isChecked}
                        onChange={(e) =>
                          setDraftActive((prev) => ({ ...prev, [zone.id]: e.target.checked }))
                        }
                        className="peer appearance-none w-11 h-11 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-card)] checked:bg-[#6B1230] checked:border-[#D4AF37] cursor-pointer disabled:opacity-60"
                      />
                      <Check
                        aria-hidden="true"
                        className="w-5 h-5 text-[#F7EFD9] pointer-events-none absolute opacity-0 peer-checked:opacity-100"
                      />
                    </div>
                    <span className="text-sm font-semibold text-[var(--text-primary)]">
                      Active
                    </span>
                  </label>
                </div>

                <div className="md:col-span-2 flex justify-end">
                  <button
                    type="button"
                    disabled={!canMutate || isSaving}
                    onClick={() => handleSaveZone(zone)}
                    className={`w-full min-h-[44px] px-4 py-2 rounded-xl text-sm font-bold inline-flex items-center justify-center gap-1.5 ${
                      canMutate && !isSaving
                        ? 'btn-luxury'
                        : 'bg-[var(--bg-surface-muted)] text-[var(--text-body-muted)] border border-[var(--border-card)] opacity-60 cursor-not-allowed'
                    }`}
                  >
                    <Save className="w-4 h-4 shrink-0" />
                    <span>{isSaving ? 'Saving...' : 'Save Zone'}</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
