/**
 * ROCK UC FOODS - Luxury Cart & Guest Checkout Modal
 * Server-authoritative snapshot pricing, Nigerian phone validation,
 * delivery zone calculation, mandatory refund policy consent, and GTBank manual transfer.
 */

import React, { useState, useEffect } from 'react';
import { useCart } from '../../order/cartContext';
import { menuRepository } from '../../menu/data';
import { formatNaira } from '../../lib/money';
import { LAGOS_DELIVERY_ZONES, getDeliveryZoneById } from '../../order/deliveryZones';
import {
  getBusinessBankSettings,
  hasVerifiedBankSettings,
  MISSING_BANK_DETAILS_CHECKOUT_MESSAGE,
} from '../../lib/businessSettings';
import {
  CHECKOUT_POLICY_CHECKBOX_LABEL,
  POLICY_VERSION,
  BUSINESS_CONTACT,
  ALLERGEN_NOTICE,
  PAYMENT_VERIFICATION_FRAUD_RULE,
} from '../../policy/content';
import { DeliveryType, Order } from '../../types/order';
import {
  X,
  ShoppingBag,
  Plus,
  Minus,
  Trash2,
  Truck,
  Store,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
  Building2,
  Tag,
  Check,
} from 'lucide-react';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOrderPlaced: (order: Order) => void;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  isOpen,
  onClose,
  onOrderPlaced,
}) => {
  const { cart, updateQuantity, removeItem, clearCart, subtotalKobo } = useCart();

  const [deliveryType, setDeliveryType] = useState<DeliveryType>('delivery');
  const [selectedZoneId, setSelectedZoneId] = useState<string>(LAGOS_DELIVERY_ZONES[0].id);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [acceptedPolicy, setAcceptedPolicy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Live Bank Details state
  const localInitial = getBusinessBankSettings();
  const [bankConfigured, setBankConfigured] = useState<boolean>(
    hasVerifiedBankSettings(localInitial)
  );
  const [bankDetails, setBankDetails] = useState<{
    bankName: string;
    accountName: string;
    accountNumber: string;
  } | null>(
    localInitial && hasVerifiedBankSettings(localInitial)
      ? {
          bankName: localInitial.bankName,
          accountName: localInitial.accountName,
          accountNumber: localInitial.accountNumber,
        }
      : null
  );

  // Promo Code State
  const [promoCodeInput, setPromoCodeInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<{
    id: string;
    code: string;
    discountKobo: bigint;
    description?: string;
  } | null>(null);
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    fetch('/api/ops/bank-details', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        if (!active) return;
        setBankConfigured(Boolean(data?.configured && data?.bankDetails));
        setBankDetails(data?.bankDetails || null);
      })
      .catch(() => {
        // Keep current state if fetch fails offline
      });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      active = false;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const cartEntries = Object.entries(cart)
    .map(([id, qty]) => ({ item: menuRepository.getItemById(id), quantity: qty }))
    .filter(
      (entry): entry is { item: NonNullable<typeof entry.item>; quantity: number } =>
        Boolean(entry.item)
    );

  const selectedZone = getDeliveryZoneById(selectedZoneId);
  const deliveryFeeKobo = deliveryType === 'collection' ? 0n : selectedZone?.feeKobo || 0n;
  const discountKobo = appliedPromo?.discountKobo || 0n;
  const totalKobo = (subtotalKobo > discountKobo ? subtotalKobo - discountKobo : 0n) + deliveryFeeKobo;

  const handleApplyPromo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promoCodeInput.trim()) return;

    setPromoLoading(true);
    setPromoError(null);

    try {
      const res = await fetch('/api/promotions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'validate',
          code: promoCodeInput.trim(),
          subtotalKobo: subtotalKobo.toString(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.isValid) {
        setPromoError(data.reason || data.error || 'Invalid or expired promo code.');
      } else {
        setAppliedPromo({
          id: data.promoCode.id,
          code: data.promoCode.code,
          discountKobo: BigInt(data.discountKobo),
          description: data.promoCode.description,
        });
        setPromoCodeInput('');
      }
    } catch (err: any) {
      setPromoError(err.message || 'Failed to validate promo code.');
    } finally {
      setPromoLoading(false);
    }
  };

  const handleRemovePromo = () => {
    setAppliedPromo(null);
    setPromoError(null);
  };

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!bankConfigured || !bankDetails) {
      setError(MISSING_BANK_DETAILS_CHECKOUT_MESSAGE);
      return;
    }

    if (cartEntries.length === 0) {
      setError('Your cart is empty. Please add at least one dish.');
      return;
    }

    if (!acceptedPolicy) {
      setError('You must agree to the Refund & Cancellation Policy before ordering.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName,
          customerPhone,
          customerEmail: customerEmail || undefined,
          deliveryType,
          deliveryZoneId: deliveryType === 'delivery' ? selectedZoneId : undefined,
          deliveryAddress: deliveryType === 'delivery' ? deliveryAddress : undefined,
          specialInstructions: specialInstructions || undefined,
          acceptedPolicy,
          policyVersion: POLICY_VERSION,
          promoCode: appliedPromo ? appliedPromo.code : undefined,
          promoCodeId: appliedPromo ? appliedPromo.id : undefined,
          items: cartEntries.map((e) => ({
            menuItemId: e.item.id,
            quantity: e.quantity,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success || !data.order) {
        throw new Error(data.error || 'Failed to place order.');
      }

      const raw = data.order;
      const hydratedOrder: Order = {
        ...raw,
        deliveryFeeKobo: BigInt(raw.deliveryFeeKobo),
        subtotalKobo: BigInt(raw.subtotalKobo),
        totalKobo: BigInt(raw.totalKobo),
        paidAmountKobo: raw.paidAmountKobo ? BigInt(raw.paidAmountKobo) : 0n,
        discountKobo: raw.discountKobo ? BigInt(raw.discountKobo) : undefined,
        trackingToken: data.trackingToken,
        items: (raw.items || []).map((i: any) => ({
          ...i,
          unitPriceKoboSnapshot: BigInt(i.unitPriceKoboSnapshot),
          totalKoboSnapshot: BigInt(i.totalKoboSnapshot),
          selectedOptionsSnapshot: (i.selectedOptionsSnapshot || []).map((o: any) => ({
            ...o,
            priceDeltaKobo: o.priceDeltaKobo ? BigInt(o.priceDeltaKobo) : 0n,
          })),
        })),
      };

      clearCart();
      onOrderPlaced(hydratedOrder);
      onClose();
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="checkout-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm overflow-y-auto"
    >
      <div className="bg-[var(--bg-card)] border border-[var(--border-gold)] rounded-2xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl text-[var(--text-primary)] my-auto min-w-0">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-[var(--border-subtle-card)] flex items-center justify-between gap-3 sticky top-0 bg-[var(--bg-card)] z-10 rounded-t-2xl">
          <div className="flex items-center gap-2.5 min-w-0">
            <ShoppingBag className="w-5 h-5 text-[var(--text-accent)] shrink-0" />
            <h2
              id="checkout-modal-title"
              className="font-serif font-bold text-lg sm:text-xl text-[var(--text-primary)] truncate"
            >
              Your Culinary Selection &amp; Checkout
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-11 h-11 flex items-center justify-center shrink-0 rounded-lg bg-[var(--bg-surface-muted)] border border-[var(--border-subtle-card)] text-[var(--text-primary)] hover:border-[var(--border-gold)]"
            aria-label="Close checkout"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1 text-sm">
          {!bankConfigured && (
            <div className="p-3.5 bg-[var(--status-danger-bg)] border border-[var(--status-danger-border)] text-[var(--status-danger-text)] rounded-xl flex items-start gap-2.5 text-sm">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <span>{MISSING_BANK_DETAILS_CHECKOUT_MESSAGE}</span>
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="p-3.5 bg-[var(--status-danger-bg)] border border-[var(--status-danger-border)] text-[var(--status-danger-text)] rounded-xl flex items-start gap-2.5 shadow text-sm font-medium"
            >
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* 1. Selected Dishes List */}
          <div>
            <h3 className="font-serif font-bold text-sm text-[var(--text-accent)] uppercase tracking-wider mb-3">
              1. Order Items ({cartEntries.length})
            </h3>
            {cartEntries.length === 0 ? (
              <div className="p-6 text-center text-[var(--text-body-muted)] bg-[var(--bg-primary)] rounded-xl border border-[var(--border-subtle-card)] text-sm">
                Your basket is empty. Browse our menu to add authentic dishes.
              </div>
            ) : (
              <div className="space-y-2.5 bg-[var(--bg-primary)] p-3 rounded-xl border border-[var(--border-subtle-card)]">
                {cartEntries.map(({ item, quantity }) => (
                  <div
                    key={item.id}
                    className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 p-2.5 border-b border-[var(--border-subtle-card)] last:border-0"
                  >
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-sm text-[var(--text-primary)] truncate">
                        {item.name}
                      </h4>
                      <p className="text-sm text-[var(--text-accent)] font-medium">
                        {formatNaira(item.priceKobo)}{' '}
                        {item.portionLabel && (
                          <span className="text-[var(--text-body-muted)]">
                            &bull; {item.portionLabel}
                          </span>
                        )}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <div className="flex items-center bg-[var(--bg-card)] border border-[var(--border-card)] rounded-lg">
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.id, quantity - 1)}
                          className="w-11 h-11 flex items-center justify-center text-[var(--text-primary)] hover:text-[var(--text-accent)]"
                          aria-label={`Decrease ${item.name}`}
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="px-2.5 font-mono text-sm font-semibold text-[var(--text-primary)]">
                          {quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.id, quantity + 1)}
                          className="w-11 h-11 flex items-center justify-center text-[var(--text-primary)] hover:text-[var(--text-accent)]"
                          aria-label={`Increase ${item.name}`}
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>

                      <span className="font-mono text-sm font-semibold text-right min-w-[80px] text-[var(--text-primary)] price-tabular">
                        {formatNaira(item.priceKobo * BigInt(quantity))}
                      </span>

                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        className="w-11 h-11 flex items-center justify-center rounded-lg text-[var(--text-body-muted)] hover:text-[var(--status-danger-text)] hover:bg-[var(--status-danger-bg)]"
                        aria-label={`Remove ${item.name}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 2. Fulfillment Type */}
          <div>
            <h3 className="font-serif font-bold text-sm text-[var(--text-accent)] uppercase tracking-wider mb-2">
              2. Fulfillment Method
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                aria-pressed={deliveryType === 'delivery'}
                onClick={() => setDeliveryType('delivery')}
                className={`min-h-[64px] p-3.5 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all text-center ${
                  deliveryType === 'delivery'
                    ? 'bg-[#6B1230] border-[#D4AF37] text-[#F7EFD9] shadow-lg'
                    : 'bg-[var(--bg-primary)] border-[var(--border-subtle-card)] text-[var(--text-primary)] hover:border-[var(--border-gold)]'
                }`}
              >
                <Truck
                  className={`w-5 h-5 ${
                    deliveryType === 'delivery' ? 'text-[#D4AF37]' : 'text-[var(--text-accent)]'
                  }`}
                />
                <span className="font-semibold text-sm">Doorstep Delivery</span>
                <span
                  className={`text-sm ${
                    deliveryType === 'delivery' ? 'text-[#F3D98B]' : 'text-[var(--text-body-muted)]'
                  }`}
                >
                  Dispatched across Lagos
                </span>
              </button>

              <button
                type="button"
                aria-pressed={deliveryType === 'collection'}
                onClick={() => setDeliveryType('collection')}
                className={`min-h-[64px] p-3.5 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all text-center ${
                  deliveryType === 'collection'
                    ? 'bg-[#6B1230] border-[#D4AF37] text-[#F7EFD9] shadow-lg'
                    : 'bg-[var(--bg-primary)] border-[var(--border-subtle-card)] text-[var(--text-primary)] hover:border-[var(--border-gold)]'
                }`}
              >
                <Store
                  className={`w-5 h-5 ${
                    deliveryType === 'collection' ? 'text-[#D4AF37]' : 'text-[var(--text-accent)]'
                  }`}
                />
                <span className="font-semibold text-sm">Self Collection</span>
                <span
                  className={`text-sm ${
                    deliveryType === 'collection'
                      ? 'text-[#F3D98B]'
                      : 'text-[var(--text-body-muted)]'
                  }`}
                >
                  FREE &bull; {BUSINESS_CONTACT.collectionAddress}
                </span>
              </button>
            </div>
          </div>

          {/* 3. Delivery Zone Selection */}
          {deliveryType === 'delivery' && (
            <div>
              <label
                htmlFor="checkout-zone"
                className="font-serif font-bold text-sm text-[var(--text-accent)] uppercase tracking-wider block mb-2"
              >
                Select Lagos Delivery Zone
              </label>
              <select
                id="checkout-zone"
                value={selectedZoneId}
                onChange={(e) => setSelectedZoneId(e.target.value)}
                className="w-full min-h-[44px] bg-[var(--bg-primary)] border border-[var(--border-card)] rounded-xl px-3 py-2.5 text-base text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-gold)]"
              >
                {LAGOS_DELIVERY_ZONES.map((zone) => (
                  <option key={zone.id} value={zone.id}>
                    {zone.name} — {formatNaira(zone.feeKobo)} ({zone.areas.slice(0, 3).join(', ')}...)
                  </option>
                ))}
              </select>
              {selectedZone && (
                <p className="text-sm text-[var(--text-body-muted)] mt-1.5 pl-1">
                  Covers: {selectedZone.areas.join(', ')}
                </p>
              )}
            </div>
          )}

          {/* 4. Customer Contact Details */}
          <div className="space-y-3">
            <h3 className="font-serif font-bold text-sm text-[var(--text-accent)] uppercase tracking-wider">
              3. Guest Customer Details
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="checkout-name"
                  className="block text-sm font-medium text-[var(--text-body-muted)] mb-1"
                >
                  Full Name <span className="text-[var(--text-accent)]">*</span>
                </label>
                <input
                  id="checkout-name"
                  type="text"
                  required
                  placeholder="e.g. Tunde Balogun"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full min-h-[44px] bg-[var(--bg-primary)] border border-[var(--border-card)] rounded-xl px-3 py-2.5 text-base text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none focus:border-[var(--border-gold)]"
                />
              </div>

              <div>
                <label
                  htmlFor="checkout-phone"
                  className="block text-sm font-medium text-[var(--text-body-muted)] mb-1"
                >
                  Nigerian Phone Number <span className="text-[var(--text-accent)]">*</span>
                </label>
                <input
                  id="checkout-phone"
                  type="tel"
                  required
                  placeholder="e.g. 0803 372 9125 or +234..."
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full min-h-[44px] bg-[var(--bg-primary)] border border-[var(--border-card)] rounded-xl px-3 py-2.5 text-base text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none focus:border-[var(--border-gold)]"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="checkout-email"
                className="block text-sm font-medium text-[var(--text-body-muted)] mb-1"
              >
                Email Address (Optional receipt)
              </label>
              <input
                id="checkout-email"
                type="email"
                placeholder="e.g. customer@example.com"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                className="w-full min-h-[44px] bg-[var(--bg-primary)] border border-[var(--border-card)] rounded-xl px-3 py-2.5 text-base text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none focus:border-[var(--border-gold)]"
              />
            </div>

            {deliveryType === 'delivery' && (
              <div>
                <label
                  htmlFor="checkout-address"
                  className="block text-sm font-medium text-[var(--text-body-muted)] mb-1"
                >
                  Delivery Street Address &amp; Landmarks{' '}
                  <span className="text-[var(--text-accent)]">*</span>
                </label>
                <textarea
                  id="checkout-address"
                  rows={2}
                  required
                  placeholder="Street name, house/flat number, estate gate, closest landmark in Lagos..."
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  className="w-full min-h-[44px] bg-[var(--bg-primary)] border border-[var(--border-card)] rounded-xl px-3 py-2.5 text-base text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none focus:border-[var(--border-gold)]"
                />
              </div>
            )}

            <div>
              <label
                htmlFor="checkout-notes"
                className="block text-sm font-medium text-[var(--text-body-muted)] mb-1"
              >
                Special Dietary or Delivery Notes (Optional)
              </label>
              <input
                id="checkout-notes"
                type="text"
                placeholder="e.g. Mild pepper, call upon arrival at gate..."
                value={specialInstructions}
                onChange={(e) => setSpecialInstructions(e.target.value)}
                className="w-full min-h-[44px] bg-[var(--bg-primary)] border border-[var(--border-card)] rounded-xl px-3 py-2.5 text-base text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none focus:border-[var(--border-gold)]"
              />
            </div>
          </div>

          {/* 5. Allergen Advisory Notice */}
          <div className="p-3.5 bg-[var(--bg-primary)] border border-[var(--border-card)] rounded-xl text-sm leading-relaxed text-[var(--text-primary)] flex gap-2.5">
            <AlertCircle className="w-5 h-5 text-[var(--text-accent)] shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-[var(--text-accent)]">Allergen Advisory: </span>
              {ALLERGEN_NOTICE}
            </div>
          </div>

          {/* 6. Payment Information: Manual GTBank Transfer */}
          <div className="p-4 bg-[var(--bg-primary)] border border-[var(--border-card)] rounded-xl space-y-2.5">
            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-accent)]">
              <Building2 className="w-4 h-4 text-[var(--text-accent)]" />
              <span>Official Nigerian Bank Transfer Details</span>
            </div>
            {bankConfigured && bankDetails ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm bg-[var(--bg-card)] p-3 rounded-lg border border-[var(--border-subtle-card)]">
                  <div>
                    <span className="text-[var(--text-body-muted)] block text-sm">Bank Name:</span>
                    <span className="font-bold text-[var(--text-primary)]">
                      {bankDetails.bankName}
                    </span>
                  </div>
                  <div>
                    <span className="text-[var(--text-body-muted)] block text-sm">
                      Account Number:
                    </span>
                    <span className="font-mono font-bold text-[var(--text-accent)] text-sm">
                      {bankDetails.accountNumber}
                    </span>
                  </div>
                  <div>
                    <span className="text-[var(--text-body-muted)] block text-sm">
                      Account Name:
                    </span>
                    <span className="font-bold text-[var(--text-primary)]">
                      {bankDetails.accountName}
                    </span>
                  </div>
                  <div>
                    <span className="text-[var(--text-body-muted)] block text-sm">
                      Transfer Narration:
                    </span>
                    <span className="text-[var(--text-primary)]">
                      Unique reference (RUC-XXXXXX) assigned after placing order
                    </span>
                  </div>
                </div>
                <p className="text-sm text-[var(--text-body-muted)] italic flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 text-[var(--text-accent)] shrink-0 mt-0.5" />
                  <span>{PAYMENT_VERIFICATION_FRAUD_RULE}</span>
                </p>
              </>
            ) : (
              <div className="p-3 rounded-lg bg-[var(--status-danger-bg)] border border-[var(--status-danger-border)] text-[var(--status-danger-text)] text-sm">
                {MISSING_BANK_DETAILS_CHECKOUT_MESSAGE}
              </div>
            )}
          </div>

          {/* 7. Mandatory Policy Consent Gate */}
          <div className="p-3.5 bg-[var(--bg-surface-muted)] border border-[var(--border-gold)] rounded-xl">
            <label
              htmlFor="checkout-accept-policy"
              className="flex items-start gap-3 cursor-pointer min-h-[44px]"
            >
              <span className="relative w-11 h-11 shrink-0 flex items-center justify-center">
                <input
                  id="checkout-accept-policy"
                  type="checkbox"
                  required
                  checked={acceptedPolicy}
                  onChange={(e) => setAcceptedPolicy(e.target.checked)}
                  className="peer appearance-none w-11 h-11 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-card)] checked:bg-[#6B1230] checked:border-[#D4AF37] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                />
                <Check className="w-5 h-5 text-[var(--cream)] pointer-events-none absolute opacity-0 peer-checked:opacity-100" />
              </span>
              <span className="text-sm text-[var(--text-primary)] leading-snug font-medium select-none pt-1">
                {CHECKOUT_POLICY_CHECKBOX_LABEL}
              </span>
            </label>
          </div>

          {/* 8. Promo Code & Voucher Section */}
          <div className="p-3.5 bg-[var(--bg-surface-muted)] border border-[var(--border-subtle-card)] rounded-xl space-y-2.5">
            <label
              htmlFor="checkout-promo"
              className="flex items-center gap-1.5 text-sm font-semibold text-[var(--text-accent)]"
            >
              <Tag className="w-4 h-4" />
              <span>Apply Promo Code or Voucher</span>
            </label>

            {appliedPromo ? (
              <div className="flex items-center justify-between gap-2 p-3 bg-[var(--status-success-bg)] border border-[var(--status-success-border)] rounded-xl text-sm">
                <div className="min-w-0">
                  <span className="font-mono font-bold text-[var(--status-success-text)] mr-2">
                    {appliedPromo.code}
                  </span>
                  <span className="text-sm text-[var(--status-success-text)]">
                    (-{formatNaira(appliedPromo.discountKobo)} applied)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleRemovePromo}
                  className="min-h-[44px] px-3 rounded-lg text-sm font-semibold text-[var(--status-danger-text)] bg-[var(--status-danger-bg)] border border-[var(--status-danger-border)] shrink-0"
                >
                  Remove
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  id="checkout-promo"
                  type="text"
                  placeholder="e.g. WELCOME10"
                  value={promoCodeInput}
                  onChange={(e) => setPromoCodeInput(e.target.value.toUpperCase())}
                  className="flex-1 min-h-[44px] min-w-0 bg-[var(--bg-primary)] border border-[var(--border-card)] rounded-xl px-3 py-2 text-base font-mono text-[var(--text-primary)] uppercase placeholder:text-[var(--text-placeholder)] focus:outline-none focus:border-[var(--border-gold)]"
                />
                <button
                  type="button"
                  disabled={!promoCodeInput.trim() || promoLoading}
                  onClick={handleApplyPromo}
                  className="min-h-[44px] px-4 py-2 bg-[#6B1230] hover:bg-[#85163C] text-[#F7EFD9] border border-[#D4AF37]/50 rounded-xl text-sm font-bold transition-all disabled:opacity-40 shrink-0"
                >
                  {promoLoading ? 'Checking...' : 'Apply'}
                </button>
              </div>
            )}

            {promoError && (
              <p className="text-sm text-[var(--status-danger-text)] pl-1">{promoError}</p>
            )}
          </div>

          {/* 9. Financial Reconciliation Summary */}
          <div className="p-4 bg-[var(--bg-primary)] rounded-xl border border-[var(--border-card)] space-y-2 font-mono text-sm">
            <div className="flex justify-between text-[var(--text-body-muted)]">
              <span>Food Subtotal:</span>
              <span className="price-tabular">{formatNaira(subtotalKobo)}</span>
            </div>
            {discountKobo > 0n && (
              <div className="flex justify-between text-[var(--text-money-positive)] font-semibold">
                <span>Promo Discount ({appliedPromo?.code}):</span>
                <span className="price-tabular">-{formatNaira(discountKobo)}</span>
              </div>
            )}
            <div className="flex justify-between text-[var(--text-body-muted)]">
              <span>
                Delivery Fee (
                {deliveryType === 'collection' ? 'Collection' : selectedZone?.name || 'Lagos'}):
              </span>
              <span className="price-tabular">{formatNaira(deliveryFeeKobo)}</span>
            </div>
            <div className="pt-2.5 border-t border-[var(--border-subtle-card)] flex justify-between font-bold text-base text-[var(--text-accent)]">
              <span>Grand Total:</span>
              <span className="price-tabular">{formatNaira(totalKobo)}</span>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 border-t border-[var(--border-subtle-card)] bg-[var(--bg-card)] flex flex-col sm:flex-row items-center justify-between gap-3 rounded-b-2xl">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto min-h-[44px] px-4 py-2 rounded-xl border border-[var(--border-card)] bg-[var(--bg-surface-muted)] text-sm font-semibold text-[var(--text-primary)] hover:border-[var(--border-gold)]"
          >
            Continue Browsing
          </button>

          <button
            type="button"
            disabled={
              cartEntries.length === 0 || !acceptedPolicy || isSubmitting || !bankConfigured
            }
            onClick={handleSubmitOrder}
            className={`w-full sm:w-auto min-h-[48px] px-6 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-xl transition-all ${
              cartEntries.length === 0 || !acceptedPolicy || isSubmitting || !bankConfigured
                ? 'opacity-50 cursor-not-allowed bg-[var(--bg-surface-muted)] text-[var(--text-body-muted)] border border-[var(--border-subtle-card)]'
                : 'bg-[#6B1230] hover:bg-[#85163C] text-[#F7EFD9] border border-[#D4AF37]/60 shadow-[#6B1230]/40'
            }`}
          >
            <CheckCircle2 className="w-4 h-4 text-[#D4AF37] shrink-0" />
            <span>
              {isSubmitting
                ? 'Validating Order...'
                : !bankConfigured
                ? 'Checkout Unavailable'
                : `Place Order & View Payment Details (${formatNaira(totalKobo)})`}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
