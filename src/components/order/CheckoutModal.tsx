/**
 * ROCK UC FOODS - Luxury Cart & Guest Checkout Modal
 * (Playbook v2 Section 7.D, 8 & Section 17 v3 Addendum)
 * Implements server-side snapshot pricing, Nigerian phone validation,
 * delivery zone calculation, and the mandatory verbatim refund policy tick box.
 */

import React, { useState } from 'react';
import { useCart } from '../../order/cartContext';
import { menuRepository } from '../../menu/data';
import { formatNaira } from '../../lib/money';
import { LAGOS_DELIVERY_ZONES, getDeliveryZoneById } from '../../order/deliveryZones';
import { createOrder } from '../../order/orderEngine';
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

  if (!isOpen) return null;

  const cartEntries = Object.entries(cart)
    .map(([id, qty]) => ({ item: menuRepository.getItemById(id), quantity: qty }))
    .filter((entry): entry is { item: NonNullable<typeof entry.item>; quantity: number } => Boolean(entry.item));

  const selectedZone = getDeliveryZoneById(selectedZoneId);
  const deliveryFeeKobo = deliveryType === 'collection' ? 0n : (selectedZone?.feeKobo || 0n);
  const totalKobo = subtotalKobo + deliveryFeeKobo;

  const handleSubmitOrder = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

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
      const order = createOrder({
        customerName,
        customerPhone,
        customerEmail: customerEmail || undefined,
        deliveryType,
        deliveryZoneId: deliveryType === 'delivery' ? selectedZoneId : undefined,
        deliveryAddress: deliveryType === 'delivery' ? deliveryAddress : undefined,
        specialInstructions: specialInstructions || undefined,
        acceptedPolicy,
        policyVersion: POLICY_VERSION,
        items: cartEntries.map((e) => ({
          menuItemId: e.item.id,
          quantity: e.quantity,
        })),
      });

      clearCart();
      onOrderPlaced(order);
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
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm overflow-y-auto"
    >
      <div className="bg-[#17120F] border border-[#D4AF37]/50 rounded-2xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl text-[#F7EFD9] my-auto">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between sticky top-0 bg-[#17120F] z-10 rounded-t-2xl">
          <div className="flex items-center gap-2.5">
            <ShoppingBag className="w-5 h-5 text-[#D4AF37]" />
            <h2 id="checkout-modal-title" className="font-serif font-bold text-lg sm:text-xl text-[#F7EFD9]">
              Your Culinary Selection &amp; Checkout
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-white/60 hover:text-white p-1 rounded hover:bg-white/10"
            aria-label="Close checkout"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1 text-xs sm:text-sm">
          {error && (
            <div className="p-3 bg-[#B3261E]/90 text-white rounded-lg flex items-start gap-2 shadow">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* 1. Selected Dishes List */}
          <div>
            <h3 className="font-serif font-bold text-sm text-[#D4AF37] uppercase tracking-wider mb-3">
              1. Order Items ({cartEntries.length})
            </h3>
            {cartEntries.length === 0 ? (
              <div className="p-6 text-center text-white/50 bg-[#0B0A09] rounded-xl border border-white/5">
                Your basket is empty. Browse our menu to add authentic dishes.
              </div>
            ) : (
              <div className="space-y-2.5 bg-[#0B0A09] p-3 rounded-xl border border-white/5">
                {cartEntries.map(({ item, quantity }) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-3 p-2 border-b border-white/5 last:border-0"
                  >
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-[#F7EFD9] truncate">{item.name}</h4>
                      <p className="text-[11px] text-[#D4AF37]">
                        {formatNaira(item.priceKobo)}{' '}
                        {item.portionLabel && <span className="text-[#F7EFD9]/50">&bull; {item.portionLabel}</span>}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <div className="flex items-center bg-[#17120F] border border-white/15 rounded">
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.id, quantity - 1)}
                          className="p-1 hover:text-[#D4AF37]"
                          aria-label={`Decrease ${item.name}`}
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="px-2 font-mono text-xs font-semibold">{quantity}</span>
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.id, quantity + 1)}
                          className="p-1 hover:text-[#D4AF37]"
                          aria-label={`Increase ${item.name}`}
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <span className="font-mono font-semibold text-right min-w-[70px]">
                        {formatNaira(item.priceKobo * BigInt(quantity))}
                      </span>

                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        className="text-white/40 hover:text-rose-400 p-1"
                        aria-label={`Remove ${item.name}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 2. Fulfillment Type (Delivery vs Collection) */}
          <div>
            <h3 className="font-serif font-bold text-sm text-[#D4AF37] uppercase tracking-wider mb-2">
              2. Fulfillment Method
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setDeliveryType('delivery')}
                className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all text-center ${
                  deliveryType === 'delivery'
                    ? 'bg-[#6B1230] border-[#D4AF37] text-white shadow-lg'
                    : 'bg-[#0B0A09] border-white/10 text-white/70 hover:border-white/30'
                }`}
              >
                <Truck className="w-5 h-5 text-[#D4AF37]" />
                <span className="font-semibold text-xs sm:text-sm">Doorstep Delivery</span>
                <span className="text-[10px] text-white/60">Dispatched across Lagos</span>
              </button>

              <button
                type="button"
                onClick={() => setDeliveryType('collection')}
                className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all text-center ${
                  deliveryType === 'collection'
                    ? 'bg-[#6B1230] border-[#D4AF37] text-white shadow-lg'
                    : 'bg-[#0B0A09] border-white/10 text-white/70 hover:border-white/30'
                }`}
              >
                <Store className="w-5 h-5 text-[#D4AF37]" />
                <span className="font-semibold text-xs sm:text-sm">Self Collection</span>
                <span className="text-[10px] text-white/60">FREE &bull; {BUSINESS_CONTACT.collectionAddress}</span>
              </button>
            </div>
          </div>

          {/* 3. Delivery Zone Selection (Only if delivery) */}
          {deliveryType === 'delivery' && (
            <div>
              <label className="font-serif font-bold text-sm text-[#D4AF37] uppercase tracking-wider block mb-2">
                Select Lagos Delivery Zone
              </label>
              <select
                value={selectedZoneId}
                onChange={(e) => setSelectedZoneId(e.target.value)}
                className="w-full bg-[#0B0A09] border border-[#D4AF37]/50 rounded-lg p-2.5 text-xs sm:text-sm text-[#F7EFD9] focus:outline-none focus:border-[#D4AF37]"
              >
                {LAGOS_DELIVERY_ZONES.map((zone) => (
                  <option key={zone.id} value={zone.id}>
                    {zone.name} — {formatNaira(zone.feeKobo)} ({zone.areas.slice(0, 3).join(', ')}...)
                  </option>
                ))}
              </select>
              {selectedZone && (
                <p className="text-[11px] text-[#F7EFD9]/60 mt-1 pl-1">
                  Covers: {selectedZone.areas.join(', ')}
                </p>
              )}
            </div>
          )}

          {/* 4. Customer Contact Details */}
          <div className="space-y-3">
            <h3 className="font-serif font-bold text-sm text-[#D4AF37] uppercase tracking-wider">
              3. Guest Customer Details
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-white/70 mb-1">
                  Full Name <span className="text-[#D4AF37]">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Tunde Balogun"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full bg-[#0B0A09] border border-white/10 rounded-lg p-2.5 text-xs text-[#F7EFD9] focus:outline-none focus:border-[#D4AF37]"
                />
              </div>

              <div>
                <label className="block text-[11px] text-white/70 mb-1">
                  Nigerian Phone Number <span className="text-[#D4AF37]">*</span>
                </label>
                <input
                  type="tel"
                  required
                  placeholder="e.g. 0803 372 9125 or +234..."
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full bg-[#0B0A09] border border-white/10 rounded-lg p-2.5 text-xs text-[#F7EFD9] focus:outline-none focus:border-[#D4AF37]"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] text-white/70 mb-1">Email Address (Optional receipt)</label>
              <input
                type="email"
                placeholder="e.g. customer@example.com"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                className="w-full bg-[#0B0A09] border border-white/10 rounded-lg p-2.5 text-xs text-[#F7EFD9] focus:outline-none focus:border-[#D4AF37]"
              />
            </div>

            {deliveryType === 'delivery' && (
              <div>
                <label className="block text-[11px] text-white/70 mb-1">
                  Delivery Street Address &amp; Landmarks <span className="text-[#D4AF37]">*</span>
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder="Street name, house/flat number, estate gate, closest landmark in Lagos..."
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  className="w-full bg-[#0B0A09] border border-white/10 rounded-lg p-2.5 text-xs text-[#F7EFD9] focus:outline-none focus:border-[#D4AF37]"
                />
              </div>
            )}

            <div>
              <label className="block text-[11px] text-white/70 mb-1">
                Special Dietary or Delivery Notes (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Mild pepper, call upon arrival at gate..."
                value={specialInstructions}
                onChange={(e) => setSpecialInstructions(e.target.value)}
                className="w-full bg-[#0B0A09] border border-white/10 rounded-lg p-2.5 text-xs text-[#F7EFD9] focus:outline-none focus:border-[#D4AF37]"
              />
            </div>
          </div>

          {/* 5. Allergen Advisory Notice */}
          <div className="p-3 bg-[#0B0A09] border border-[#D4AF37]/30 rounded-lg text-[11px] leading-relaxed text-[#F7EFD9]/80 flex gap-2">
            <AlertCircle className="w-4 h-4 text-[#D4AF37] shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-[#D4AF37]">Allergen Advisory: </span>
              {ALLERGEN_NOTICE}
            </div>
          </div>

          {/* 6. Payment Information: Verified Bank Transfer */}
          <div className="p-3.5 bg-[#0B0A09] border border-white/10 rounded-xl space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#D4AF37]">
              <Building2 className="w-4 h-4 text-[#D4AF37]" />
              <span>Official Bank Transfer Details</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] bg-[#17120F] p-2.5 rounded border border-white/5">
              <div>
                <span className="text-white/50 block">Bank Name:</span>
                <span className="font-bold text-[#F7EFD9]">Wema Bank</span>
              </div>
              <div>
                <span className="text-white/50 block">Account Number:</span>
                <span className="font-mono font-bold text-[#D4AF37] text-xs">0258778644</span>
              </div>
              <div>
                <span className="text-white/50 block">Account Name:</span>
                <span className="font-bold text-[#F7EFD9]">ROCK UC FOODS / ESTHER KWENTUA</span>
              </div>
              <div>
                <span className="text-white/50 block">Reference:</span>
                <span className="text-white/70">Your unique Order ID (assigned on checkout)</span>
              </div>
            </div>
            <p className="text-[10px] text-amber-200/80 italic flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              {PAYMENT_VERIFICATION_FRAUD_RULE}
            </p>
          </div>

          {/* 7. Mandatory Policy Consent Gate */}
          <div className="p-3 bg-[#17120F] border border-[#D4AF37]/60 rounded-xl">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                required
                checked={acceptedPolicy}
                onChange={(e) => setAcceptedPolicy(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded text-[#6B1230] accent-[#D4AF37] cursor-pointer"
              />
              <span className="text-[11px] sm:text-xs text-[#F7EFD9] leading-snug font-medium select-none">
                {CHECKOUT_POLICY_CHECKBOX_LABEL}
              </span>
            </label>
          </div>

          {/* 8. Financial Reconciliation Summary */}
          <div className="p-4 bg-[#0B0A09] rounded-xl border border-white/10 space-y-1.5 font-mono text-xs">
            <div className="flex justify-between text-white/70">
              <span>Food Subtotal:</span>
              <span>{formatNaira(subtotalKobo)}</span>
            </div>
            <div className="flex justify-between text-white/70">
              <span>Delivery Fee ({deliveryType === 'collection' ? 'Collection' : selectedZone?.name || 'Lagos'}):</span>
              <span>{formatNaira(deliveryFeeKobo)}</span>
            </div>
            <div className="pt-2 border-t border-white/10 flex justify-between font-bold text-sm sm:text-base text-[#D4AF37]">
              <span>Grand Total:</span>
              <span>{formatNaira(totalKobo)}</span>
            </div>
          </div>
        </div>

        {/* Modal Footer / Action Button */}
        <div className="p-4 sm:p-5 border-t border-white/10 bg-[#17120F] flex flex-col sm:flex-row items-center justify-between gap-3 rounded-b-2xl">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2 rounded text-xs text-white/70 hover:text-white"
          >
            Continue Browsing
          </button>

          <button
            type="button"
            disabled={cartEntries.length === 0 || !acceptedPolicy || isSubmitting}
            onClick={handleSubmitOrder}
            className={`w-full sm:w-auto px-6 py-3 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xl transition-all ${
              cartEntries.length === 0 || !acceptedPolicy || isSubmitting
                ? 'opacity-40 cursor-not-allowed bg-white/10 text-white/40'
                : 'bg-[#6B1230] hover:bg-[#85163C] text-[#F7EFD9] border border-[#D4AF37]/50 shadow-[#6B1230]/40'
            }`}
          >
            <CheckCircle2 className="w-4 h-4 text-[#D4AF37]" />
            <span>
              {isSubmitting
                ? 'Validating Order...'
                : `Place Order & View Payment Details (${formatNaira(totalKobo)})`}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
