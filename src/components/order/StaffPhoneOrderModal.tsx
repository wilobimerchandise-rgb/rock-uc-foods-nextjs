'use client';

/**
 * ROCK UC FOODS - Staff Phone / WhatsApp Order Entry Modal
 * Lets staff/owner place orders received by phone or WhatsApp using authoritative
 * catalog prices, size tiers, options, active Lagos zones, and server-generated RUC-XXXXXX ref.
 */

import React, { useMemo, useState } from 'react';
import { menuRepository } from '../../menu/data';
import { getOrderablePrice } from '../../menu/pricing';
import { getAllDeliveryZones } from '../../order/deliveryZones';
import { formatNaira } from '../../lib/money';
import { POLICY_VERSION } from '../../policy/content';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  MessageCircle,
  PhoneCall,
  Plus,
  Trash2,
  X,
} from 'lucide-react';

interface DraftLine {
  key: string;
  menuItemId: string;
  itemName: string;
  selectedTierId?: string;
  tierName?: string;
  selectedOptionIds: string[];
  optionSummary: string;
  quantity: number;
  unitKobo: bigint;
}

export interface StaffPhoneOrderModalProps {
  onClose: () => void;
  onOrderCreated: (summaryMessage: string) => void;
}

export const StaffPhoneOrderModal: React.FC<StaffPhoneOrderModalProps> = ({
  onClose,
  onOrderCreated,
}) => {
  const availableItems = useMemo(
    () =>
      menuRepository
        .getItems(false)
        .filter((i) => i.isAvailable && !menuRepository.isItemSoldOutToday(i)),
    []
  );
  const activeZones = useMemo(() => getAllDeliveryZones(false), []);

  const firstItem = availableItems[0];
  const [selectedItemId, setSelectedItemId] = useState<string>(firstItem?.id || '');
  const selectedItem = availableItems.find((i) => i.id === selectedItemId) || firstItem;

  const activeTiersForSelected = useMemo(
    () => (selectedItem?.sizeTiers || []).filter((t) => t.active),
    [selectedItem]
  );

  const [selectedTierId, setSelectedTierId] = useState<string>(
    activeTiersForSelected[0]?.id || ''
  );
  const [selectedOptionIds, setSelectedOptionIds] = useState<string[]>([]);
  const [lineQty, setLineQty] = useState<number>(1);
  const [lines, setLines] = useState<DraftLine[]>([]);

  const [channel, setChannel] = useState<'Phone' | 'WhatsApp' | 'Walk-in'>('Phone');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [deliveryType, setDeliveryType] = useState<'delivery' | 'collection'>('delivery');
  const [deliveryZoneId, setDeliveryZoneId] = useState<string>(activeZones[0]?.id || '');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [verbalConsentConfirmed, setVerbalConsentConfirmed] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [createdOrder, setCreatedOrder] = useState<{
    orderCode: string;
    paymentReference: string;
    totalFormatted: string;
    whatsappShareUrl: string;
    bankSummary: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSelectItemChange = (nextId: string) => {
    setSelectedItemId(nextId);
    const nextItem = availableItems.find((i) => i.id === nextId);
    const nextTiers = (nextItem?.sizeTiers || []).filter((t) => t.active);
    setSelectedTierId(nextTiers[0]?.id || '');
    setSelectedOptionIds([]);
  };

  const handleToggleOption = (optId: string) => {
    setSelectedOptionIds((prev) =>
      prev.includes(optId) ? prev.filter((id) => id !== optId) : [...prev, optId]
    );
  };

  const handleAddLine = () => {
    if (!selectedItem) {
      setErrorMsg('No published available menu items found.');
      return;
    }
    setErrorMsg(null);
    try {
      const tierToUse =
        activeTiersForSelected.length > 0
          ? selectedTierId || activeTiersForSelected[0].id
          : undefined;
      const priced = getOrderablePrice(selectedItem.id, selectedOptionIds, tierToUse);
      const qty = Math.max(1, Math.min(100, Math.floor(Number(lineQty) || 1)));

      const lineKey = `${selectedItem.id}:${tierToUse || 'base'}:${selectedOptionIds
        .slice()
        .sort()
        .join(',')}`;

      setLines((prev) => {
        const existing = prev.find((l) => l.key === lineKey);
        if (existing) {
          return prev.map((l) =>
            l.key === lineKey ? { ...l, quantity: Math.min(100, l.quantity + qty) } : l
          );
        }
        return [
          ...prev,
          {
            key: lineKey,
            menuItemId: selectedItem.id,
            itemName: selectedItem.name,
            selectedTierId: priced.tierId,
            tierName: priced.tierName,
            selectedOptionIds: priced.optionSnapshots.map((o) => o.id),
            optionSummary: priced.optionSnapshots.map((o) => o.name).join(', '),
            quantity: qty,
            unitKobo: priced.totalUnitKobo,
          },
        ];
      });
    } catch (err: any) {
      setErrorMsg(err?.message || 'Unable to add dish.');
    }
  };

  const subtotalKobo = lines.reduce(
    (acc, line) => acc + line.unitKobo * BigInt(line.quantity),
    0n
  );
  const selectedZone = activeZones.find((z) => z.id === deliveryZoneId);
  const deliveryFeeKobo = deliveryType === 'collection' ? 0n : selectedZone?.feeKobo ?? 0n;
  const estimatedTotalKobo = subtotalKobo + deliveryFeeKobo;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (lines.length === 0) {
      setErrorMsg('Please add at least one dish to this order.');
      return;
    }
    if (!verbalConsentConfirmed) {
      setErrorMsg('Confirm the customer verbally accepted the Refund & Cancellation Policy.');
      return;
    }

    setSubmitting(true);
    try {
      const combinedNotes = [
        `[${channel} Order]`,
        specialInstructions.trim(),
      ]
        .filter(Boolean)
        .join(' ');

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          customerEmail: customerEmail.trim() || undefined,
          deliveryType,
          deliveryZoneId: deliveryType === 'delivery' ? deliveryZoneId : undefined,
          deliveryAddress: deliveryType === 'delivery' ? deliveryAddress.trim() : undefined,
          specialInstructions: combinedNotes,
          acceptedPolicy: true,
          policyVersion: POLICY_VERSION,
          items: lines.map((l) => ({
            menuItemId: l.menuItemId,
            quantity: l.quantity,
            selectedTierId: l.selectedTierId,
            selectedOptionIds: l.selectedOptionIds,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data?.error || 'Could not create phone/WhatsApp order.');
      }

      const bank = data.bankDetails;
      const bankSummary = bank
        ? `${bank.bankName} | ${bank.accountName} | ${bank.accountNumber}`
        : 'Verified GTBank Account';
      const totalFormatted = formatNaira(estimatedTotalKobo);
      const waDigits = customerPhone.replace(/\D/g, '').replace(/^0/, '234');
      const messageText = `Hello ${customerName.trim()}, your ROCK UC FOODS order ${
        data.orderCode
      } (${totalFormatted}) has been logged. Transfer exact total with narration ${
        data.paymentReference
      } to ${bankSummary}.`;

      setCreatedOrder({
        orderCode: data.orderCode,
        paymentReference: data.paymentReference,
        totalFormatted,
        bankSummary,
        whatsappShareUrl: `https://wa.me/${waDigits}?text=${encodeURIComponent(messageText)}`,
      });
      onOrderCreated(`Logged ${channel} order ${data.orderCode} (Ref: ${data.paymentReference}).`);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to place phone order.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="staff-phone-order-title"
      className="fixed inset-0 bg-black/85 flex items-center justify-center p-4 z-50"
      data-testid="staff-phone-order-modal"
    >
      <div className="bg-[var(--bg-card)] border border-[var(--border-gold)] rounded-2xl max-w-2xl w-full p-5 sm:p-6 max-h-[90vh] overflow-y-auto text-[var(--text-primary)] space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle-card)]">
          <div className="flex items-center gap-2">
            <PhoneCall className="w-5 h-5 text-[var(--text-accent)] shrink-0" />
            <h2 id="staff-phone-order-title" className="text-lg font-serif font-bold text-[var(--text-primary)]">
              Log Phone / WhatsApp Order
            </h2>
          </div>
          <button
            type="button"
            aria-label="Close phone order dialog"
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-lg text-[var(--text-body-muted)] hover:text-[var(--text-primary)]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div
            role="alert"
            className="p-3.5 rounded-xl bg-[var(--status-danger-bg)] border border-[var(--status-danger-border)] text-[var(--status-danger-text)] text-sm flex items-center gap-2 font-semibold"
          >
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {createdOrder ? (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-[var(--status-success-bg)] border border-[var(--status-success-border)] text-[var(--status-success-text)] space-y-1">
              <div className="flex items-center gap-2 font-bold text-base">
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                <span>Order Logged: {createdOrder.orderCode}</span>
              </div>
              <p className="text-sm font-mono price-tabular">
                Transfer Narration Reference: <strong>{createdOrder.paymentReference}</strong> &bull; Total:{' '}
                <strong>{createdOrder.totalFormatted}</strong>
              </p>
              <p className="text-sm">Bank: {createdOrder.bankSummary}</p>
            </div>

            <div className="flex flex-wrap gap-3 justify-end">
              <button
                type="button"
                onClick={() => {
                  if (navigator?.clipboard?.writeText) {
                    void navigator.clipboard.writeText(
                      `${createdOrder.orderCode} | Ref: ${createdOrder.paymentReference} | ${createdOrder.totalFormatted} | ${createdOrder.bankSummary}`
                    );
                  }
                  setCopied(true);
                }}
                className="min-h-[44px] px-4 py-2 rounded-xl border border-[var(--border-card)] bg-[var(--bg-surface-muted)] text-[var(--text-primary)] text-sm font-semibold inline-flex items-center gap-1.5"
              >
                <Copy className="w-4 h-4 text-[var(--text-accent)]" />
                <span>{copied ? 'Details Copied' : 'Copy Transfer Summary'}</span>
              </button>

              <a
                href={createdOrder.whatsappShareUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[44px] px-4 py-2 rounded-xl bg-[#6B1230] text-[#F7EFD9] border border-[#D4AF37]/60 text-sm font-bold inline-flex items-center gap-1.5"
              >
                <MessageCircle className="w-4 h-4 text-[#D4AF37]" /> Send on WhatsApp
              </a>

              <button
                type="button"
                onClick={onClose}
                className="btn-luxury text-sm font-bold"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Step 1: Dish Selector */}
            <div className="p-4 rounded-xl bg-[var(--bg-surface-muted)] border border-[var(--border-card)] space-y-3">
              <span className="text-sm font-bold text-[var(--text-accent)] block">
                1. Build Order Items (Authoritative Menu Prices)
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                <div className="sm:col-span-6">
                  <label htmlFor="phone-order-dish" className="block text-sm font-semibold text-[var(--text-primary)] mb-1">
                    Dish
                  </label>
                  <select
                    id="phone-order-dish"
                    value={selectedItemId}
                    onChange={(e) => handleSelectItemChange(e.target.value)}
                    className="w-full min-h-[44px] bg-[var(--bg-primary)] border border-[var(--border-card)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)]"
                  >
                    {availableItems.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} (
                        {item.sizeTiers && item.sizeTiers.length > 0
                          ? `From ${formatNaira(item.sizeTiers[0].priceKobo)}`
                          : formatNaira(item.priceKobo)}
                        )
                      </option>
                    ))}
                  </select>
                </div>

                {activeTiersForSelected.length > 0 && (
                  <div className="sm:col-span-3">
                    <label htmlFor="phone-order-tier" className="block text-sm font-semibold text-[var(--text-primary)] mb-1">
                      Size Tier
                    </label>
                    <select
                      id="phone-order-tier"
                      value={selectedTierId || activeTiersForSelected[0]?.id}
                      onChange={(e) => setSelectedTierId(e.target.value)}
                      className="w-full min-h-[44px] bg-[var(--bg-primary)] border border-[var(--border-card)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)]"
                    >
                      {activeTiersForSelected.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.label} ({formatNaira(t.priceKobo)})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className={activeTiersForSelected.length > 0 ? 'sm:col-span-3' : 'sm:col-span-3'}>
                  <label htmlFor="phone-order-qty" className="block text-sm font-semibold text-[var(--text-primary)] mb-1">
                    Qty
                  </label>
                  <input
                    id="phone-order-qty"
                    type="number"
                    min={1}
                    max={100}
                    value={lineQty}
                    onChange={(e) => setLineQty(Number(e.target.value) || 1)}
                    className="w-full min-h-[44px] bg-[var(--bg-primary)] border border-[var(--border-card)] rounded-lg px-3 py-2 text-sm font-mono price-tabular text-[var(--text-primary)]"
                  />
                </div>
              </div>

              {selectedItem?.optionGroups && selectedItem.optionGroups.length > 0 && (
                <div className="space-y-2 pt-1">
                  {selectedItem.optionGroups.map((g) => (
                    <div key={g.id} className="space-y-1">
                      <span className="text-sm font-semibold text-[var(--text-accent)] block">
                        {g.name}
                      </span>
                      <div className="flex flex-wrap gap-3">
                        {g.options
                          .filter((o) => o.isAvailable)
                          .map((opt) => (
                            <label
                              key={opt.id}
                              className="flex items-center gap-2 cursor-pointer min-h-[44px] text-sm"
                            >
                              <div className="relative w-11 h-11 shrink-0 flex items-center justify-center">
                                <input
                                  type="checkbox"
                                  checked={selectedOptionIds.includes(opt.id)}
                                  onChange={() => handleToggleOption(opt.id)}
                                  className="peer appearance-none w-11 h-11 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-card)] checked:bg-[#6B1230] checked:border-[#D4AF37]"
                                />
                                <Check className="w-5 h-5 text-[#F7EFD9] pointer-events-none absolute opacity-0 peer-checked:opacity-100" />
                              </div>
                              <span>
                                {opt.name} (+{formatNaira(opt.priceDeltaKobo)})
                              </span>
                            </label>
                          ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={handleAddLine}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-[var(--bg-card)] border border-[var(--border-gold)] text-[var(--text-accent)] text-sm font-semibold inline-flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" /> Add Dish to Order
              </button>

              {lines.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-[var(--border-subtle-card)]">
                  {lines.map((line) => (
                    <div
                      key={line.key}
                      className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border-subtle-card)] text-sm"
                    >
                      <div className="min-w-0">
                        <span className="font-semibold text-[var(--text-primary)]">
                          {line.quantity}x {line.itemName}
                          {line.tierName ? ` (${line.tierName})` : ''}
                        </span>
                        {line.optionSummary && (
                          <span className="block text-sm text-[var(--text-body-muted)]">
                            {line.optionSummary}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono font-bold text-[var(--text-accent)] price-tabular">
                          {formatNaira(line.unitKobo * BigInt(line.quantity))}
                        </span>
                        <button
                          type="button"
                          aria-label={`Remove ${line.itemName}`}
                          onClick={() => setLines((prev) => prev.filter((l) => l.key !== line.key))}
                          className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-lg bg-[var(--status-danger-bg)] text-[var(--status-danger-text)] border border-[var(--status-danger-border)]"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Step 2: Customer & Dispatch */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label htmlFor="phone-order-channel" className="block text-sm font-semibold text-[var(--text-accent)] mb-1">
                  Intake Channel
                </label>
                <select
                  id="phone-order-channel"
                  value={channel}
                  onChange={(e) => setChannel(e.target.value as 'Phone' | 'WhatsApp' | 'Walk-in')}
                  className="w-full min-h-[44px] bg-[var(--bg-primary)] border border-[var(--border-card)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)]"
                >
                  <option value="Phone">Phone Call</option>
                  <option value="WhatsApp">WhatsApp Chat</option>
                  <option value="Walk-in">Kitchen Walk-in</option>
                </select>
              </div>
              <div>
                <label htmlFor="phone-order-name" className="block text-sm font-semibold text-[var(--text-accent)] mb-1">
                  Customer Name
                </label>
                <input
                  id="phone-order-name"
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="e.g. Mrs. Adeyemi"
                  className="w-full min-h-[44px] bg-[var(--bg-primary)] border border-[var(--border-card)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)]"
                />
              </div>
              <div>
                <label htmlFor="phone-order-phone" className="block text-sm font-semibold text-[var(--text-accent)] mb-1">
                  Nigerian Phone
                </label>
                <input
                  id="phone-order-phone"
                  type="tel"
                  required
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="08033729125"
                  className="w-full min-h-[44px] bg-[var(--bg-primary)] border border-[var(--border-card)] rounded-lg px-3 py-2 text-sm font-mono price-tabular text-[var(--text-primary)]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="phone-order-delivery-type" className="block text-sm font-semibold text-[var(--text-accent)] mb-1">
                  Fulfilment Method
                </label>
                <select
                  id="phone-order-delivery-type"
                  value={deliveryType}
                  onChange={(e) => setDeliveryType(e.target.value as 'delivery' | 'collection')}
                  className="w-full min-h-[44px] bg-[var(--bg-primary)] border border-[var(--border-card)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)]"
                >
                  <option value="delivery">Lagos Rider Delivery</option>
                  <option value="collection">Kitchen Pickup (5 Aro Street, Lagos)</option>
                </select>
              </div>

              {deliveryType === 'delivery' ? (
                <div>
                  <label htmlFor="phone-order-zone" className="block text-sm font-semibold text-[var(--text-accent)] mb-1">
                    Active Lagos Zone
                  </label>
                  <select
                    id="phone-order-zone"
                    value={deliveryZoneId}
                    onChange={(e) => setDeliveryZoneId(e.target.value)}
                    className="w-full min-h-[44px] bg-[var(--bg-primary)] border border-[var(--border-card)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)]"
                  >
                    {activeZones.map((z) => (
                      <option key={z.id} value={z.id}>
                        {z.name} ({formatNaira(z.feeKobo)})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label htmlFor="phone-order-email" className="block text-sm font-semibold text-[var(--text-accent)] mb-1">
                    Customer Email (Optional)
                  </label>
                  <input
                    id="phone-order-email"
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    className="w-full min-h-[44px] bg-[var(--bg-primary)] border border-[var(--border-card)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)]"
                  />
                </div>
              )}
            </div>

            {deliveryType === 'delivery' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="phone-order-address" className="block text-sm font-semibold text-[var(--text-accent)] mb-1">
                    Lagos Street Address
                  </label>
                  <input
                    id="phone-order-address"
                    type="text"
                    required
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    placeholder="Street, estate, landmark in Lagos"
                    className="w-full min-h-[44px] bg-[var(--bg-primary)] border border-[var(--border-card)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)]"
                  />
                </div>
                <div>
                  <label htmlFor="phone-order-email-del" className="block text-sm font-semibold text-[var(--text-accent)] mb-1">
                    Customer Email (Optional)
                  </label>
                  <input
                    id="phone-order-email-del"
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    className="w-full min-h-[44px] bg-[var(--bg-primary)] border border-[var(--border-card)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)]"
                  />
                </div>
              </div>
            )}

            <div>
              <label htmlFor="phone-order-notes" className="block text-sm font-semibold text-[var(--text-accent)] mb-1">
                Dietary / Allergy / Call Notes
              </label>
              <input
                id="phone-order-notes"
                type="text"
                value={specialInstructions}
                onChange={(e) => setSpecialInstructions(e.target.value)}
                placeholder="Spice preference, severe allergy, delivery timing..."
                className="w-full min-h-[44px] bg-[var(--bg-primary)] border border-[var(--border-card)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)]"
              />
            </div>

            <label
              htmlFor="phone-order-consent"
              className="flex items-center gap-3 cursor-pointer min-h-[44px]"
            >
              <div className="relative w-11 h-11 shrink-0 flex items-center justify-center">
                <input
                  id="phone-order-consent"
                  type="checkbox"
                  checked={verbalConsentConfirmed}
                  onChange={(e) => setVerbalConsentConfirmed(e.target.checked)}
                  className="peer appearance-none w-11 h-11 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-card)] checked:bg-[#6B1230] checked:border-[#D4AF37]"
                />
                <Check className="w-5 h-5 text-[#F7EFD9] pointer-events-none absolute opacity-0 peer-checked:opacity-100" />
              </div>
              <span className="text-sm text-[var(--text-primary)]">
                Customer verbally confirmed Refund &amp; Cancellation Policy ({POLICY_VERSION}).
              </span>
            </label>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-[var(--border-subtle-card)]">
              <div className="text-sm font-mono price-tabular">
                <span className="text-[var(--text-body-muted)] block">
                  Food: {formatNaira(subtotalKobo)} + Delivery: {formatNaira(deliveryFeeKobo)}
                </span>
                <span className="text-base font-bold text-[var(--text-accent)]">
                  Estimated Total: {formatNaira(estimatedTotalKobo)}
                </span>
              </div>

              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  className="min-h-[44px] px-4 py-2 rounded-xl border border-[var(--border-subtle-card)] text-[var(--text-body-muted)] text-sm font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-luxury text-sm font-bold"
                >
                  {submitting ? 'Creating Order...' : 'Create Order & Generate RUC Ref'}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
