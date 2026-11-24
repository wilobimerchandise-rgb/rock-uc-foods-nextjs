'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCart } from '../../src/order/cartContext';
import { LAGOS_DELIVERY_ZONES } from '../../src/order/deliveryZones';
import { formatMoneyKobo } from '../../src/lib/money';
import {
  POLICY_VERSION,
  CHECKOUT_POLICY_CHECKBOX_LABEL,
  PAYMENT_VERIFICATION_FRAUD_RULE,
  ALLERGEN_NOTICE,
  BUSINESS_CONTACT,
} from '../../src/policy/content';
import {
  ShoppingBag,
  ArrowLeft,
  Truck,
  Store,
  ShieldCheck,
  Building2,
  AlertTriangle,
  Loader2,
  Clock,
  Check,
  Plus,
  Minus,
  Trash2,
} from 'lucide-react';

interface BankDetailsPayload {
  configured: boolean;
  bankDetails: {
    bankName: string;
    accountName: string;
    accountNumber: string;
  } | null;
  message: string | null;
}

export default function CheckoutPage() {
  const router = useRouter();
  const { items, subtotalKobo, updateQuantity, removeItem, clearCart } = useCart();

  // Form State
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [deliveryType, setDeliveryType] = useState<'delivery' | 'collection'>('delivery');
  const [deliveryZoneId, setDeliveryZoneId] = useState(LAGOS_DELIVERY_ZONES[0].id);
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [acceptedPolicy, setAcceptedPolicy] = useState(false);

  // Live DB Bank Details state
  const [bankLoading, setBankLoading] = useState(true);
  const [bankState, setBankState] = useState<BankDetailsPayload>({
    configured: false,
    bankDetails: null,
    message: null,
  });

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    fetch('/api/ops/bank-details', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data: BankDetailsPayload) => {
        if (mounted) {
          setBankState({
            configured: Boolean(data?.configured && data?.bankDetails),
            bankDetails: data?.bankDetails || null,
            message:
              data?.message || 'Payment details unavailable, contact us on 08033729125',
          });
        }
      })
      .catch(() => {
        if (mounted) {
          setBankState({
            configured: false,
            bankDetails: null,
            message: 'Payment details unavailable, contact us on 08033729125',
          });
        }
      })
      .finally(() => {
        if (mounted) setBankLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  // Delivery fee calculation in BigInt kobo
  const deliveryFeeKobo = useMemo(() => {
    if (deliveryType === 'collection') return 0n;
    const zone = LAGOS_DELIVERY_ZONES.find((z) => z.id === deliveryZoneId);
    return zone ? zone.feeKobo : 250000n;
  }, [deliveryType, deliveryZoneId]);

  const grandTotalKobo = subtotalKobo + deliveryFeeKobo;

  const bankUnavailable = !bankLoading && !bankState.configured;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!bankState.configured || !bankState.bankDetails) {
      setErrorMessage(
        bankState.message || 'Payment details unavailable, contact us on 08033729125'
      );
      return;
    }

    if (items.length === 0) {
      setErrorMessage('Your cart is empty. Please add dishes before checkout.');
      return;
    }

    if (!customerName.trim() || customerName.trim().length < 2) {
      setErrorMessage('Please provide your full name (minimum 2 characters).');
      return;
    }

    if (!customerPhone.trim()) {
      setErrorMessage('Please enter your Nigerian telephone number.');
      return;
    }

    if (
      deliveryType === 'delivery' &&
      (!deliveryAddress.trim() || deliveryAddress.trim().length < 5)
    ) {
      setErrorMessage('Please provide your full Lagos delivery address.');
      return;
    }

    if (!acceptedPolicy) {
      setErrorMessage('You must accept the Refund & Cancellation Policy to proceed.');
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        customerEmail: customerEmail.trim() || undefined,
        deliveryType,
        deliveryZoneId: deliveryType === 'delivery' ? deliveryZoneId : undefined,
        deliveryAddress: deliveryType === 'delivery' ? deliveryAddress.trim() : undefined,
        specialInstructions: specialInstructions.trim() || undefined,
        acceptedPolicy,
        policyVersion: POLICY_VERSION,
        items: items.map((item) => ({
          menuItemId: item.menuItemId,
          quantity: item.quantity,
          selectedTierId: item.selectedTierId,
          selectedOptionIds: item.selectedOptionIds,
        })),
      };

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to place order.');
      }

      clearCart();
      router.push(data.trackingUrl || `/order/${data.orderCode}`);
    } catch (err: any) {
      setErrorMessage(err?.message || 'An error occurred while creating your order.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Navigation & Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-card)] pb-4">
          <Link
            href="/menu"
            className="inline-flex items-center min-h-[44px] min-w-[44px] gap-2 text-sm uppercase tracking-wider text-[var(--text-accent)] hover:underline font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] rounded-lg pr-2"
          >
            <ArrowLeft className="w-4 h-4 shrink-0" />
            <span>Back to Menu</span>
          </Link>

          <h1 className="font-serif text-base sm:text-lg font-bold text-[var(--text-body-muted)] tracking-wider">
            {BUSINESS_CONTACT.name} CHECKOUT
          </h1>
        </div>

        {bankUnavailable && (
          <div
            role="alert"
            className="p-4 rounded-2xl bg-[var(--status-danger-bg)] border border-[var(--status-danger-border)] text-[var(--status-danger-text)] flex items-start gap-3 text-sm"
          >
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-base">Checkout Temporarily Unavailable</p>
              <p className="text-sm mt-0.5">
                {bankState.message || 'Payment details unavailable, contact us on 08033729125'}
              </p>
            </div>
          </div>
        )}

        {items.length === 0 ? (
          <div className="p-8 sm:p-12 text-center rounded-3xl bg-[var(--bg-card)] border border-[var(--border-card)] space-y-4">
            <div className="w-16 h-16 rounded-full bg-[var(--bg-surface-muted)] border border-[var(--border-gold)] flex items-center justify-center text-[var(--text-accent)] mx-auto">
              <ShoppingBag className="w-8 h-8" />
            </div>
            <h2 className="font-serif text-2xl font-bold text-[var(--text-primary)]">
              Your cart is empty
            </h2>
            <p className="text-sm text-[var(--text-body-muted)] max-w-sm mx-auto leading-relaxed">
              You haven&apos;t added any meals yet. Browse our signature menu to place your fresh
              order.
            </p>
            <Link
              href="/menu"
              className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] mt-2 bg-[var(--cta-gold-bg)] hover:bg-[var(--cta-gold-hover)] text-[var(--cta-gold-text)] font-bold text-sm uppercase tracking-wider py-3 px-6 rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
            >
              Explore Menu
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left Column: Form Details */}
            <div className="lg:col-span-7 space-y-6">
              {/* Customer Contact */}
              <section className="bg-[var(--bg-card)] border border-[var(--border-card)] rounded-2xl p-5 sm:p-6 space-y-4 shadow-lg">
                <h2 className="font-serif text-lg sm:text-xl font-bold text-[var(--text-primary)] border-b border-[var(--border-card)] pb-2.5">
                  1. Contact Information
                </h2>

                <div className="space-y-4">
                  <div>
                    <label
                      htmlFor="checkout-name"
                      className="block text-sm uppercase tracking-wider font-semibold text-[var(--text-accent)] mb-1.5"
                    >
                      Full Name *
                    </label>
                    <input
                      id="checkout-name"
                      type="text"
                      required
                      minLength={2}
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="e.g. Chief Adeleke Johnson"
                      className="w-full min-h-[44px] bg-[var(--bg-primary)] border border-[var(--border-input)] focus:border-[var(--border-gold)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-body-muted)] placeholder:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label
                        htmlFor="checkout-phone"
                        className="block text-sm uppercase tracking-wider font-semibold text-[var(--text-accent)] mb-1.5"
                      >
                        Telephone (WhatsApp) *
                      </label>
                      <input
                        id="checkout-phone"
                        type="tel"
                        required
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        placeholder="08033729125 or +234..."
                        className="w-full min-h-[44px] bg-[var(--bg-primary)] border border-[var(--border-input)] focus:border-[var(--border-gold)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-body-muted)] placeholder:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                      />
                      <p className="text-sm text-[var(--text-body-muted)] mt-1.5">
                        We send cooking &amp; dispatch alerts to this number.
                      </p>
                    </div>

                    <div>
                      <label
                        htmlFor="checkout-email"
                        className="block text-sm uppercase tracking-wider font-semibold text-[var(--text-accent)] mb-1.5"
                      >
                        Email Address (Optional)
                      </label>
                      <input
                        id="checkout-email"
                        type="email"
                        value={customerEmail}
                        onChange={(e) => setCustomerEmail(e.target.value)}
                        placeholder="name@example.com"
                        className="w-full min-h-[44px] bg-[var(--bg-primary)] border border-[var(--border-input)] focus:border-[var(--border-gold)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-body-muted)] placeholder:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                      />
                    </div>
                  </div>
                </div>
              </section>

              {/* Delivery or Collection */}
              <section className="bg-[var(--bg-card)] border border-[var(--border-card)] rounded-2xl p-5 sm:p-6 space-y-4 shadow-lg">
                <h2 className="font-serif text-lg sm:text-xl font-bold text-[var(--text-primary)] border-b border-[var(--border-card)] pb-2.5">
                  2. Fulfilment Option
                </h2>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setDeliveryType('delivery')}
                    aria-pressed={deliveryType === 'delivery'}
                    className={`min-h-[56px] p-3.5 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] ${
                      deliveryType === 'delivery'
                        ? 'border-[var(--border-gold)] bg-[var(--bg-surface-muted)] ring-2 ring-[var(--border-gold)] text-[var(--text-primary)]'
                        : 'border-[var(--border-card)] bg-[var(--bg-primary)] hover:border-[var(--border-gold)] text-[var(--text-body-muted)]'
                    }`}
                  >
                    <Truck className="w-5 h-5 text-[var(--icon-on-surface)]" />
                    <span className="text-sm font-bold uppercase tracking-wide">
                      Lagos Delivery
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDeliveryType('collection')}
                    aria-pressed={deliveryType === 'collection'}
                    className={`min-h-[56px] p-3.5 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] ${
                      deliveryType === 'collection'
                        ? 'border-[var(--border-gold)] bg-[var(--bg-surface-muted)] ring-2 ring-[var(--border-gold)] text-[var(--text-primary)]'
                        : 'border-[var(--border-card)] bg-[var(--bg-primary)] hover:border-[var(--border-gold)] text-[var(--text-body-muted)]'
                    }`}
                  >
                    <Store className="w-5 h-5 text-[var(--icon-on-surface)]" />
                    <span className="text-sm font-bold uppercase tracking-wide">
                      Free Pick-up
                    </span>
                  </button>
                </div>

                {deliveryType === 'delivery' ? (
                  <div className="space-y-4 pt-2">
                    <div>
                      <label
                        htmlFor="checkout-zone"
                        className="block text-sm uppercase tracking-wider font-semibold text-[var(--text-accent)] mb-1.5"
                      >
                        Delivery Zone *
                      </label>
                      <select
                        id="checkout-zone"
                        value={deliveryZoneId}
                        onChange={(e) => setDeliveryZoneId(e.target.value)}
                        className="w-full min-h-[44px] bg-[var(--bg-primary)] border border-[var(--border-input)] focus:border-[var(--border-gold)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] cursor-pointer"
                      >
                        {LAGOS_DELIVERY_ZONES.map((zone) => (
                          <option
                            key={zone.id}
                            value={zone.id}
                            className="bg-[var(--bg-card)] text-[var(--text-primary)]"
                          >
                            {zone.name} — {formatMoneyKobo(zone.feeKobo)} (
                            {zone.areas.slice(0, 3).join(', ')}...)
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label
                        htmlFor="checkout-address"
                        className="block text-sm uppercase tracking-wider font-semibold text-[var(--text-accent)] mb-1.5"
                      >
                        Street Address &amp; Landmarks *
                      </label>
                      <textarea
                        id="checkout-address"
                        required
                        rows={3}
                        value={deliveryAddress}
                        onChange={(e) => setDeliveryAddress(e.target.value)}
                        placeholder="e.g. 14 Isaac John Street, opposite Police College Gate, GRA, Ikeja, Lagos"
                        className="w-full min-h-[44px] bg-[var(--bg-primary)] border border-[var(--border-input)] focus:border-[var(--border-gold)] rounded-xl p-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-body-muted)] placeholder:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-[var(--bg-surface-muted)] border border-[var(--border-card)] space-y-1.5">
                    <span className="text-sm font-bold text-[var(--text-accent)] uppercase tracking-wider block">
                      Kitchen Collection Address
                    </span>
                    <p className="text-sm font-semibold text-[var(--text-primary)]">
                      {BUSINESS_CONTACT.collectionAddress}
                    </p>
                    <p className="text-sm text-[var(--text-body-muted)]">
                      We will notify you on WhatsApp the moment your meal is packed hot from the
                      cooker.
                    </p>
                  </div>
                )}

                <div>
                  <label
                    htmlFor="checkout-notes"
                    className="block text-sm uppercase tracking-wider font-semibold text-[var(--text-accent)] mb-1.5"
                  >
                    Special Cooking / Dietary Notes (Optional)
                  </label>
                  <input
                    id="checkout-notes"
                    type="text"
                    value={specialInstructions}
                    onChange={(e) => setSpecialInstructions(e.target.value)}
                    placeholder="e.g. Please pack pepper sauce in separate container"
                    className="w-full min-h-[44px] bg-[var(--bg-primary)] border border-[var(--border-input)] focus:border-[var(--border-gold)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-body-muted)] placeholder:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                  />
                </div>
              </section>

              {/* Manual Nigerian Bank Transfer Payment Box */}
              <section className="bg-[var(--bg-card)] border border-[var(--border-card)] rounded-2xl p-5 sm:p-6 space-y-4 shadow-lg">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-card)] pb-2.5">
                  <h2 className="font-serif text-lg sm:text-xl font-bold text-[var(--text-primary)] flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-[var(--icon-on-surface)] shrink-0" />
                    <span>3. Manual Nigerian Bank Transfer</span>
                  </h2>
                  <span className="text-sm uppercase tracking-wider px-2.5 py-1 rounded-lg bg-[var(--bg-surface-muted)] border border-[var(--border-gold)] text-[var(--text-accent)] font-semibold flex items-center gap-1.5">
                    <Clock className="w-4 h-4 shrink-0" /> 7h Window
                  </span>
                </div>

                {bankLoading ? (
                  <p className="text-sm text-[var(--text-body-muted)]">
                    Loading official bank transfer details...
                  </p>
                ) : bankState.configured && bankState.bankDetails ? (
                  <div className="p-4 rounded-xl bg-[var(--bg-surface-muted)] border border-[var(--border-card)] text-sm space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <span className="text-[var(--text-body-muted)] block text-sm">
                          Bank Name
                        </span>
                        <span className="font-bold text-[var(--text-primary)]">
                          {bankState.bankDetails.bankName}
                        </span>
                      </div>
                      <div>
                        <span className="text-[var(--text-body-muted)] block text-sm">
                          Account Name
                        </span>
                        <span className="font-bold text-[var(--text-primary)]">
                          {bankState.bankDetails.accountName}
                        </span>
                      </div>
                      <div>
                        <span className="text-[var(--text-body-muted)] block text-sm">
                          Account Number
                        </span>
                        <span className="font-mono price-tabular font-bold text-base text-[var(--text-accent)]">
                          {bankState.bankDetails.accountNumber}
                        </span>
                      </div>
                      <div>
                        <span className="text-[var(--text-body-muted)] block text-sm">
                          Exact Amount
                        </span>
                        <span className="font-mono price-tabular font-bold text-base text-[var(--text-money-positive)]">
                          {formatMoneyKobo(grandTotalKobo)}
                        </span>
                      </div>
                    </div>
                    <p className="text-sm text-[var(--text-primary)] pt-3 border-t border-[var(--border-subtle-card)] leading-relaxed">
                      After clicking <strong>Place Order</strong>, we will generate a unique payment
                      reference (e.g.{' '}
                      <span className="font-mono text-[var(--text-accent)] font-semibold">
                        RUC-XXXXXX
                      </span>
                      ) for your transfer narration and allow you to upload your transfer proof.
                    </p>
                    <p className="text-sm text-[var(--text-body-muted)] italic">
                      {PAYMENT_VERIFICATION_FRAUD_RULE}
                    </p>
                  </div>
                ) : (
                  <div
                    role="alert"
                    className="p-4 rounded-xl bg-[var(--status-danger-bg)] border border-[var(--status-danger-border)] text-[var(--status-danger-text)] text-sm"
                  >
                    {bankState.message ||
                      'Payment details unavailable, contact us on 08033729125'}
                  </div>
                )}
              </section>
            </div>

            {/* Right Column: Order Summary & Policy Consent Gate */}
            <div className="lg:col-span-5 space-y-6">
              <div className="bg-[var(--bg-card)] border border-[var(--border-gold)] rounded-2xl p-5 sm:p-6 space-y-5 shadow-2xl lg:sticky lg:top-6">
                <h2 className="font-serif text-lg sm:text-xl font-bold text-[var(--text-primary)] border-b border-[var(--border-card)] pb-3">
                  Order Summary
                </h2>

                {/* Items */}
                <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                  {items.map((item) => (
                    <div
                      key={item.key}
                      className="p-3 rounded-xl bg-[var(--bg-surface-muted)] border border-[var(--border-subtle-card)] space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2 text-sm">
                        <div className="min-w-0">
                          <span className="font-semibold text-[var(--text-primary)] block">
                            {item.quantity}x {item.name}
                          </span>
                          {item.selectedTierName && (
                            <span className="block text-sm text-[var(--text-accent)] font-medium">
                              Size: {item.selectedTierName}
                            </span>
                          )}
                          {item.selectedOptionNames && item.selectedOptionNames.length > 0 && (
                            <span className="block text-sm text-[var(--text-body-muted)] truncate">
                              + {item.selectedOptionNames.join(', ')}
                            </span>
                          )}
                        </div>
                        <span className="font-mono price-tabular font-bold text-[var(--text-accent)] shrink-0 whitespace-nowrap">
                          {formatMoneyKobo(item.itemTotalKobo)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <div className="flex items-center gap-1 bg-[var(--bg-card)] border border-[var(--border-card)] rounded-lg p-0.5">
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.key, item.quantity - 1)}
                            aria-label={`Decrease quantity of ${item.name}`}
                            className="min-w-[44px] min-h-[44px] rounded flex items-center justify-center text-[var(--text-accent)] hover:bg-[var(--bg-surface-muted)] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                          <span className="font-mono price-tabular text-sm font-bold text-[var(--text-primary)] min-w-[2rem] text-center">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.key, item.quantity + 1)}
                            aria-label={`Increase quantity of ${item.name}`}
                            className="min-w-[44px] min-h-[44px] rounded flex items-center justify-center text-[var(--text-accent)] hover:bg-[var(--bg-surface-muted)] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => removeItem(item.key)}
                          aria-label={`Remove ${item.name} from checkout`}
                          className="min-w-[44px] min-h-[44px] rounded flex items-center justify-center text-[var(--text-body-muted)] hover:text-[var(--text-error)] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Totals Breakdown */}
                <div className="border-t border-[var(--border-card)] pt-3 space-y-2 text-sm">
                  <div className="flex justify-between text-[var(--text-body-muted)]">
                    <span>Subtotal</span>
                    <span className="font-mono price-tabular">{formatMoneyKobo(subtotalKobo)}</span>
                  </div>
                  <div className="flex justify-between text-[var(--text-body-muted)]">
                    <span>
                      Fulfilment ({deliveryType === 'delivery' ? 'Delivery' : 'Pick-up'})
                    </span>
                    <span className="font-mono price-tabular">
                      {formatMoneyKobo(deliveryFeeKobo)}
                    </span>
                  </div>
                  <div className="border-t border-[var(--border-gold)] pt-2.5 flex items-baseline justify-between text-base font-bold text-[var(--text-accent)]">
                    <span>Total Due</span>
                    <span className="font-sans price-tabular text-xl whitespace-nowrap">
                      {formatMoneyKobo(grandTotalKobo)}
                    </span>
                  </div>
                </div>

                {/* Mandatory Policy Tick Box Gate */}
                <div className="p-3.5 rounded-xl bg-[var(--bg-surface-muted)] border border-[var(--border-card)] space-y-2">
                  <div className="flex items-start gap-2">
                    <div className="relative flex items-center justify-center w-11 h-11 shrink-0">
                      <input
                        id="checkout-policy"
                        type="checkbox"
                        required
                        checked={acceptedPolicy}
                        onChange={(e) => setAcceptedPolicy(e.target.checked)}
                        aria-label="Accept Refund and Cancellation Policy"
                        className="peer appearance-none w-11 h-11 rounded-lg cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                      />
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute w-5 h-5 rounded border-2 border-[var(--border-gold)] bg-[var(--bg-card)] peer-checked:bg-[var(--cta-gold-bg)] peer-checked:border-[var(--cta-gold-bg)] flex items-center justify-center text-[var(--cta-gold-text)]"
                      >
                        {acceptedPolicy && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </span>
                    </div>
                    <label
                      htmlFor="checkout-policy"
                      className="text-sm text-[var(--text-primary)] leading-relaxed cursor-pointer pt-1.5"
                    >
                      {CHECKOUT_POLICY_CHECKBOX_LABEL}{' '}
                      <Link
                        href="/refund-policy"
                        target="_blank"
                        className="inline-flex items-center min-h-[44px] text-[var(--text-link)] font-semibold underline hover:opacity-85"
                      >
                        (Read full policy)
                      </Link>
                    </label>
                  </div>
                </div>

                {/* Allergen advisory */}
                <div className="p-3 rounded-lg bg-[var(--bg-surface-muted)] border border-[var(--border-subtle-card)] flex items-start gap-2.5 text-sm text-[var(--text-body-muted)] leading-normal">
                  <AlertTriangle className="w-4 h-4 text-[var(--icon-on-surface)] shrink-0 mt-0.5" />
                  <span>{ALLERGEN_NOTICE}</span>
                </div>

                {errorMessage && (
                  <div
                    role="alert"
                    className="p-3.5 rounded-xl bg-[var(--status-danger-bg)] border border-[var(--status-danger-border)] text-[var(--status-danger-text)] text-sm font-medium"
                  >
                    {errorMessage}
                  </div>
                )}

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={
                    !acceptedPolicy ||
                    isSubmitting ||
                    items.length === 0 ||
                    bankLoading ||
                    !bankState.configured
                  }
                  className="w-full min-h-[48px] bg-[var(--cta-gold-bg)] hover:bg-[var(--cta-gold-hover)] text-[var(--cta-gold-text)] font-bold text-base py-3.5 px-6 rounded-xl shadow-xl transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                      <span>Creating Order...</span>
                    </>
                  ) : !bankLoading && !bankState.configured ? (
                    <span>Checkout Unavailable</span>
                  ) : (
                    <>
                      <ShieldCheck className="w-5 h-5 shrink-0" />
                      <span className="price-tabular">
                        Place Order • {formatMoneyKobo(grandTotalKobo)}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
