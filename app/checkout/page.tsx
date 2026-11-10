'use client';

import React, { useState, useMemo } from 'react';
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
  CreditCard,
  Building2,
  AlertTriangle,
  Loader2,
} from 'lucide-react';

export default function CheckoutPage() {
  const router = useRouter();
  const { items, subtotalKobo, clearCart } = useCart();

  // Form State
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [deliveryType, setDeliveryType] = useState<'delivery' | 'collection'>('delivery');
  const [deliveryZoneId, setDeliveryZoneId] = useState(LAGOS_DELIVERY_ZONES[0].id);
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [acceptedPolicy, setAcceptedPolicy] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'online' | 'bank_transfer'>('online');

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Delivery fee calculation
  const deliveryFeeKobo = useMemo(() => {
    if (deliveryType === 'collection') return 0n;
    const zone = LAGOS_DELIVERY_ZONES.find((z) => z.id === deliveryZoneId);
    return zone ? zone.feeKobo : 250000n;
  }, [deliveryType, deliveryZoneId]);

  const grandTotalKobo = subtotalKobo + deliveryFeeKobo;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

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

    if (deliveryType === 'delivery' && (!deliveryAddress.trim() || deliveryAddress.trim().length < 5)) {
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
      router.push(`/order/${data.orderCode}`);
    } catch (err: any) {
      setErrorMessage(err.message || 'An error occurred while creating your order.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0A09] text-[#F7EFD9] py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Navigation & Header */}
        <div className="flex items-center justify-between border-b border-[#D4AF37]/20 pb-5">
          <Link
            href="/menu"
            className="inline-flex items-center gap-2 text-xs uppercase tracking-wider text-[#D4AF37] hover:text-[#F7EFD9] font-semibold transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Menu</span>
          </Link>

          <span className="font-serif text-sm text-[#F7EFD9]/60 tracking-wider">
            {BUSINESS_CONTACT.name} CHECKOUT
          </span>
        </div>

        {items.length === 0 ? (
          <div className="p-12 text-center rounded-3xl bg-[#17120F] border border-[#D4AF37]/30 space-y-4">
            <div className="w-16 h-16 rounded-full bg-[#0B0A09] border border-[#D4AF37]/20 flex items-center justify-center text-[#D4AF37] mx-auto">
              <ShoppingBag className="w-8 h-8" />
            </div>
            <h1 className="font-serif text-2xl font-bold text-[#F7EFD9]">Your cart is empty</h1>
            <p className="text-sm text-[#F7EFD9]/70 max-w-sm mx-auto">
              You haven&apos;t added any meals yet. Browse our signature menu to place your fresh order.
            </p>
            <Link
              href="/menu"
              className="inline-block mt-2 bg-[#D4AF37] hover:bg-[#E5C158] text-[#0B0A09] font-bold text-xs uppercase tracking-wider py-3 px-6 rounded-xl transition-colors"
            >
              Explore Menu
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left Column: Form Details */}
            <div className="lg:col-span-7 space-y-6">
              {/* Customer Contact */}
              <section className="bg-[#17120F] border border-[#D4AF37]/30 rounded-2xl p-5 sm:p-6 space-y-4 shadow-lg">
                <h2 className="font-serif text-lg font-bold text-[#F7EFD9] border-b border-[#D4AF37]/15 pb-2">
                  1. Contact Information
                </h2>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs uppercase tracking-wider font-semibold text-[#D4AF37] mb-1.5">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="e.g. Chief Adeleke Johnson"
                      className="w-full bg-[#0B0A09] border border-[#D4AF37]/30 focus:border-[#D4AF37] rounded-xl px-4 py-2.5 text-sm text-[#F7EFD9] placeholder-[#F7EFD9]/40 focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs uppercase tracking-wider font-semibold text-[#D4AF37] mb-1.5">
                        Telephone (WhatsApp) *
                      </label>
                      <input
                        type="tel"
                        required
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        placeholder="08033729125 or +234..."
                        className="w-full bg-[#0B0A09] border border-[#D4AF37]/30 focus:border-[#D4AF37] rounded-xl px-4 py-2.5 text-sm text-[#F7EFD9] placeholder-[#F7EFD9]/40 focus:outline-none"
                      />
                      <p className="text-[10px] text-[#F7EFD9]/50 mt-1">
                        We send cooking &amp; dispatch alerts to this number.
                      </p>
                    </div>

                    <div>
                      <label className="block text-xs uppercase tracking-wider font-semibold text-[#D4AF37] mb-1.5">
                        Email Address (Optional)
                      </label>
                      <input
                        type="email"
                        value={customerEmail}
                        onChange={(e) => setCustomerEmail(e.target.value)}
                        placeholder="name@example.com"
                        className="w-full bg-[#0B0A09] border border-[#D4AF37]/30 focus:border-[#D4AF37] rounded-xl px-4 py-2.5 text-sm text-[#F7EFD9] placeholder-[#F7EFD9]/40 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              </section>

              {/* Delivery or Collection */}
              <section className="bg-[#17120F] border border-[#D4AF37]/30 rounded-2xl p-5 sm:p-6 space-y-4 shadow-lg">
                <h2 className="font-serif text-lg font-bold text-[#F7EFD9] border-b border-[#D4AF37]/15 pb-2">
                  2. Fulfilment Option
                </h2>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setDeliveryType('delivery')}
                    className={`p-3.5 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      deliveryType === 'delivery'
                        ? 'border-[#D4AF37] bg-[#D4AF37]/15 ring-2 ring-[#D4AF37]/30 text-[#F7EFD9]'
                        : 'border-[#D4AF37]/25 bg-[#0B0A09]/60 hover:border-[#D4AF37]/50 text-[#F7EFD9]/70'
                    }`}
                  >
                    <Truck className="w-5 h-5 text-[#D4AF37]" />
                    <span className="text-xs font-bold uppercase tracking-wide">Lagos Delivery</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDeliveryType('collection')}
                    className={`p-3.5 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      deliveryType === 'collection'
                        ? 'border-[#D4AF37] bg-[#D4AF37]/15 ring-2 ring-[#D4AF37]/30 text-[#F7EFD9]'
                        : 'border-[#D4AF37]/25 bg-[#0B0A09]/60 hover:border-[#D4AF37]/50 text-[#F7EFD9]/70'
                    }`}
                  >
                    <Store className="w-5 h-5 text-[#D4AF37]" />
                    <span className="text-xs font-bold uppercase tracking-wide">Free Pick-up</span>
                  </button>
                </div>

                {deliveryType === 'delivery' ? (
                  <div className="space-y-4 pt-2">
                    <div>
                      <label className="block text-xs uppercase tracking-wider font-semibold text-[#D4AF37] mb-1.5">
                        Delivery Zone *
                      </label>
                      <select
                        value={deliveryZoneId}
                        onChange={(e) => setDeliveryZoneId(e.target.value)}
                        className="w-full bg-[#0B0A09] border border-[#D4AF37]/30 focus:border-[#D4AF37] rounded-xl px-4 py-2.5 text-sm text-[#F7EFD9] focus:outline-none cursor-pointer"
                      >
                        {LAGOS_DELIVERY_ZONES.map((zone) => (
                          <option key={zone.id} value={zone.id} className="bg-[#17120F]">
                            {zone.name} — {formatMoneyKobo(zone.feeKobo)} ({zone.areas.slice(0, 3).join(', ')}...)
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs uppercase tracking-wider font-semibold text-[#D4AF37] mb-1.5">
                        Street Address &amp; Landmarks *
                      </label>
                      <textarea
                        required
                        rows={3}
                        value={deliveryAddress}
                        onChange={(e) => setDeliveryAddress(e.target.value)}
                        placeholder="e.g. 14 Isaac John Street, opposite Police College Gate, GRA, Ikeja, Lagos"
                        className="w-full bg-[#0B0A09] border border-[#D4AF37]/30 focus:border-[#D4AF37] rounded-xl p-3 text-sm text-[#F7EFD9] placeholder-[#F7EFD9]/40 focus:outline-none"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-[#0B0A09] border border-[#D4AF37]/25 space-y-1">
                    <span className="text-xs font-bold text-[#D4AF37] uppercase tracking-wider">
                      Kitchen Collection Address
                    </span>
                    <p className="text-sm text-[#F7EFD9]">{BUSINESS_CONTACT.collectionAddress}</p>
                    <p className="text-xs text-[#F7EFD9]/60">
                      We will notify you on WhatsApp the moment your meal is packed hot from the cooker.
                    </p>
                  </div>
                )}

                <div>
                  <label className="block text-xs uppercase tracking-wider font-semibold text-[#D4AF37] mb-1.5">
                    Special Cooking / Dietary Notes (Optional)
                  </label>
                  <input
                    type="text"
                    value={specialInstructions}
                    onChange={(e) => setSpecialInstructions(e.target.value)}
                    placeholder="e.g. Please pack pepper sauce in separate container"
                    className="w-full bg-[#0B0A09] border border-[#D4AF37]/30 focus:border-[#D4AF37] rounded-xl px-4 py-2 text-sm text-[#F7EFD9] placeholder-[#F7EFD9]/40 focus:outline-none"
                  />
                </div>
              </section>

              {/* Payment Mode Selection */}
              <section className="bg-[#17120F] border border-[#D4AF37]/30 rounded-2xl p-5 sm:p-6 space-y-4 shadow-lg">
                <h2 className="font-serif text-lg font-bold text-[#F7EFD9] border-b border-[#D4AF37]/15 pb-2">
                  3. Payment Method
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('online')}
                    className={`p-4 rounded-xl border flex items-start gap-3 transition-all cursor-pointer text-left ${
                      paymentMethod === 'online'
                        ? 'border-[#D4AF37] bg-[#D4AF37]/15 ring-2 ring-[#D4AF37]/30'
                        : 'border-[#D4AF37]/25 bg-[#0B0A09]/60 hover:border-[#D4AF37]/50'
                    }`}
                  >
                    <CreditCard className="w-5 h-5 text-[#D4AF37] shrink-0 mt-0.5" />
                    <div>
                      <span className="text-xs font-bold text-[#F7EFD9] block">
                        Online Payment
                      </span>
                      <span className="text-[11px] text-[#F7EFD9]/60 block mt-0.5">
                        Debit Card, USSD, Apple Pay, Instant Transfer
                      </span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('bank_transfer')}
                    className={`p-4 rounded-xl border flex items-start gap-3 transition-all cursor-pointer text-left ${
                      paymentMethod === 'bank_transfer'
                        ? 'border-[#D4AF37] bg-[#D4AF37]/15 ring-2 ring-[#D4AF37]/30'
                        : 'border-[#D4AF37]/25 bg-[#0B0A09]/60 hover:border-[#D4AF37]/50'
                    }`}
                  >
                    <Building2 className="w-5 h-5 text-[#D4AF37] shrink-0 mt-0.5" />
                    <div>
                      <span className="text-xs font-bold text-[#F7EFD9] block">
                        Direct Bank Transfer
                      </span>
                      <span className="text-[11px] text-[#F7EFD9]/60 block mt-0.5">
                        Access Bank verified transfer with WhatsApp confirmation
                      </span>
                    </div>
                  </button>
                </div>

                {paymentMethod === 'bank_transfer' && (
                  <div className="p-3.5 rounded-xl bg-[#0B0A09] border border-[#D4AF37]/30 text-xs text-[#F7EFD9]/80 space-y-1.5">
                    <p className="font-semibold text-[#D4AF37]">Official Bank Details:</p>
                    <p className="font-mono text-sm text-[#F7EFD9]">Access Bank • 0803372912 • Chef Esther Kwentua</p>
                    <p className="text-[11px] text-[#F7EFD9]/60 italic">
                      {PAYMENT_VERIFICATION_FRAUD_RULE}
                    </p>
                  </div>
                )}
              </section>
            </div>

            {/* Right Column: Order Summary & Policy Consent Gate */}
            <div className="lg:col-span-5 space-y-6">
              <div className="bg-[#17120F] border border-[#D4AF37]/40 rounded-2xl p-5 sm:p-6 space-y-5 shadow-2xl sticky top-6">
                <h2 className="font-serif text-lg font-bold text-[#F7EFD9] border-b border-[#D4AF37]/20 pb-3">
                  Order Summary
                </h2>

                {/* Items */}
                <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                  {items.map((item) => (
                    <div key={item.key} className="flex items-start justify-between gap-2 text-xs">
                      <div className="min-w-0">
                        <span className="font-medium text-[#F7EFD9]">
                          {item.quantity}x {item.name}
                        </span>
                        {item.selectedTierName && (
                          <span className="block text-[10px] text-[#D4AF37]">
                            Size: {item.selectedTierName}
                          </span>
                        )}
                        {item.selectedOptionNames && item.selectedOptionNames.length > 0 && (
                          <span className="block text-[10px] text-[#F7EFD9]/60 truncate">
                            + {item.selectedOptionNames.join(', ')}
                          </span>
                        )}
                      </div>
                      <span className="font-mono font-bold text-[#D4AF37] shrink-0">
                        {formatMoneyKobo(item.itemTotalKobo)}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Totals Breakdown */}
                <div className="border-t border-[#D4AF37]/20 pt-3 space-y-2 text-xs">
                  <div className="flex justify-between text-[#F7EFD9]/70">
                    <span>Subtotal</span>
                    <span className="font-mono">{formatMoneyKobo(subtotalKobo)}</span>
                  </div>
                  <div className="flex justify-between text-[#F7EFD9]/70">
                    <span>
                      Fulfilment ({deliveryType === 'delivery' ? 'Delivery' : 'Pick-up'})
                    </span>
                    <span className="font-mono">{formatMoneyKobo(deliveryFeeKobo)}</span>
                  </div>
                  <div className="border-t border-[#D4AF37]/30 pt-2 flex items-baseline justify-between text-base font-bold text-[#D4AF37]">
                    <span>Total Due</span>
                    <span className="font-sans text-xl whitespace-nowrap">
                      {formatMoneyKobo(grandTotalKobo)}
                    </span>
                  </div>
                </div>

                {/* Section 17.2 Mandatory Policy Tick Box Gate */}
                <div className="p-3.5 rounded-xl bg-[#0B0A09] border border-[#D4AF37]/30 space-y-2">
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      required
                      checked={acceptedPolicy}
                      onChange={(e) => setAcceptedPolicy(e.target.checked)}
                      className="mt-1 w-4 h-4 rounded border-[#D4AF37]/50 text-[#D4AF37] focus:ring-[#D4AF37] focus:ring-offset-[#0B0A09] bg-[#17120F] shrink-0 cursor-pointer"
                    />
                    <span className="text-[11px] text-[#F7EFD9]/80 leading-relaxed select-none">
                      {CHECKOUT_POLICY_CHECKBOX_LABEL}{' '}
                      <Link
                        href="/refund-policy"
                        target="_blank"
                        className="text-[#D4AF37] underline hover:text-[#E5C158]"
                      >
                        (Read full policy)
                      </Link>
                    </span>
                  </label>
                </div>

                {/* Allergen advisory */}
                <div className="p-2.5 rounded-lg bg-[#0B0A09]/50 border border-white/5 flex items-start gap-2 text-[10px] text-[#F7EFD9]/60 leading-normal">
                  <AlertTriangle className="w-3.5 h-3.5 text-[#D4AF37] shrink-0 mt-0.5" />
                  <span>{ALLERGEN_NOTICE}</span>
                </div>

                {errorMessage && (
                  <div className="p-3 rounded-xl bg-[#6B1230]/70 border border-[#FF8585]/40 text-[#FF8585] text-xs">
                    {errorMessage}
                  </div>
                )}

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={!acceptedPolicy || isSubmitting || items.length === 0}
                  className="w-full bg-gradient-to-r from-[#D4AF37] to-[#B08D26] hover:from-[#E5C158] hover:to-[#D4AF37] text-[#0B0A09] font-bold text-sm py-3.5 px-6 rounded-xl shadow-xl transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Creating Order...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      <span>Place Order • {formatMoneyKobo(grandTotalKobo)}</span>
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
