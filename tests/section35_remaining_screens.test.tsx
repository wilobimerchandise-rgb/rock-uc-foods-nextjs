/**
 * ROCK UC FOODS - Playbook §35.8 Remaining Screens & Components Audit Suite
 *
 * Covers:
 * - EstimatorClient (initialTierId, initialConfig, aria-pressed, BigInt Naira, zero border-l-4)
 * - CustomerInvoiceView (BigInt lineTotalKobo math, fallback bank banner, >=48px CTAs, semantic tokens)
 * - AdminInvoiceDetailClient (RBAC phone masking, BigInt line totals, >=44px controls)
 * - Legal & 404 routes (/terms, /privacy, /catering, /not-found) preserving "needs lawyer review"
 * - Auth forms (LoginForm, MfaForm) with paired labels and >=44px targets
 * - Modals/Drawers/Menu (EventInquiryModal, StepUpVerificationModal, NotificationHistoryDrawer, PublicMenu)
 * - Strict zero sub-14px typography (<14px Tailwind classes) across all rendered markup
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { EstimatorClient } from '../src/components/EstimatorClient';
import { serializeEstimatorConfig, INITIAL_ESTIMATOR_CONFIG } from '../src/estimator/config';
import { CustomerInvoiceView } from '../src/components/invoices/CustomerInvoiceView';
import { AdminInvoiceDetailClient } from '../src/components/admin/AdminInvoiceDetailClient';
import { StaffUserManager } from '../src/components/admin/StaffUserManager';
import { ReconciliationManager } from '../src/components/payment/ReconciliationManager';
import { LoginForm } from '../src/components/auth/LoginForm';
import { MfaForm } from '../src/components/auth/MfaForm';
import { EventInquiryModal } from '../src/components/catering/EventInquiryModal';
import { StepUpVerificationModal } from '../src/components/security/StepUpVerificationModal';
import { NotificationHistoryDrawer } from '../src/components/notifications/NotificationHistoryDrawer';
import { PublicMenu } from '../src/components/menu/PublicMenu';
import { CartProvider } from '../src/order/cartContext';
import { CheckoutModal } from '../src/components/order/CheckoutModal';
import { OrderTrackingView } from '../src/components/order/OrderTrackingView';
import TermsOfServicePage from '../app/terms/page';
import PrivacyPolicyPage from '../app/privacy/page';
import CateringPage from '../app/catering/page';
import NotFound from '../app/not-found';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams('next=/admin&step=verify'),
  usePathname: () => '/login',
}));

function assertNoSub14pxClasses(html: string, label: string) {
  expect(html, `${label} should not contain text-xs`).not.toMatch(/\btext-xs\b/);
  expect(html, `${label} should not contain text-[10px]`).not.toContain('text-[10px]');
  expect(html, `${label} should not contain text-[11px]`).not.toContain('text-[11px]');
  expect(html, `${label} should not contain text-[12px]`).not.toContain('text-[12px]');
}

describe('Playbook §35.8 Remaining Screens & Components Hardening', () => {
  it('1. EstimatorClient honours initialTierId="tier-gold", aria-pressed, BigInt Naira, and semantic CSS vars', () => {
    const serialized = serializeEstimatorConfig(INITIAL_ESTIMATOR_CONFIG);
    const html = renderToStaticMarkup(
      <EstimatorClient initialTierId="tier-gold" initialConfig={serialized} />
    );

    // Selected tier button marks aria-pressed="true" for Gold Royal
    expect(html).toContain('Gold Royal');
    expect(html).toMatch(/aria-pressed="true"[^>]*>[\s\S]*Gold Royal|Gold Royal[\s\S]*aria-pressed="true"/);
    // Avoids narrow edge strip
    expect(html).not.toContain('border-l-4');
    // Uses semantic tokens and >=44px interactive controls
    expect(html).toContain('var(--bg-card)');
    expect(html).toContain('min-h-[44px]');
    // Independent golden math: Gold min 151 guests * ₦26,000.00 = ₦3,926,000.00
    expect(html).toContain('₦3,926,000.00');
    assertNoSub14pxClasses(html, 'EstimatorClient');
  });

  it('2. CustomerInvoiceView formats BigInt line totals, preserves fallback bank notice, and has >=48px CTAs', () => {
    const html = renderToStaticMarkup(
      <CustomerInvoiceView
        invoice={{
          publicRef: 'EVT-20261115-TEST',
          revision: 1,
          status: 'issued',
          customerName: 'Chidi Obi',
          customerPhone: '08033729125',
          lines: [
            {
              name: 'Party Jollof & Grilled Turkey Platter',
              quantity: 2,
              unitPriceKobo: '875000',
              lineTotalKobo: '1750000',
            },
          ],
          formattedTotal: '₦17,500.00',
          formattedDeposit: '₦12,250.00',
          formattedBalance: '₦5,250.00',
          createdAt: '2026-11-15T10:00:00.000Z',
          pdfDownloadUrl: '/api/invoices/EVT-20261115-TEST/pdf?token=abc',
          whatsappProofUrl: 'https://wa.me/2348033729125?text=Proof',
          bankDetails: null,
        }}
      />
    );

    expect(html).toContain('₦17,500.00');
    expect(html).toContain('Payment details will be sent by ROCK UC FOODS.');
    expect(html).toContain('Send Payment Proof on WhatsApp');
    expect(html).toContain('Download Official PDF');
    expect(html).toContain('min-h-[48px]');
    expect(html).toContain('var(--bg-primary)');
    expect(html).toContain('rounded-md');
    assertNoSub14pxClasses(html, 'CustomerInvoiceView');
  });

  it('3. AdminInvoiceDetailClient enforces phone masking for non-owner staff and renders BigInt Naira', () => {
    const html = renderToStaticMarkup(
      <AdminInvoiceDetailClient
        userRole="staff"
        hasMfaVerified={false}
        invoice={{
          id: 'inv-test-1',
          publicRef: 'EVT-20261115-ADM1',
          revision: 1,
          status: 'draft',
          customerName: 'Ngozi Nwosu',
          customerPhone: '08033729125',
          guests: 50,
          lines: [
            {
              name: 'Bronze Feast, 50 guests',
              quantity: 50,
              unitPriceKobo: '1250000',
              lineTotalKobo: '62500000',
            },
          ],
          totalKobo: '73750000',
          formattedTotal: '₦737,500.00',
          depositKobo: '51625000',
          formattedDeposit: '₦516,250.00',
          balanceKobo: '22125000',
          formattedBalance: '₦221,250.00',
          createdAt: '2026-11-15T10:00:00.000Z',
          linksCount: 0,
        }}
      />
    );

    expect(html).toContain('₦625,000.00');
    expect(html).toContain('₦737,500.00');
    expect(html).not.toContain('08033729125');
    expect(html).toContain('*** *** 9125');
    expect(html).toContain('var(--bg-primary)');
    assertNoSub14pxClasses(html, 'AdminInvoiceDetailClient');
  });

  it('4. Legal, Catering, and 404 routes preserve "needs lawyer review", semantic tokens, and >=14px text', () => {
    const termsHtml = renderToStaticMarkup(<TermsOfServicePage />);
    const privacyHtml = renderToStaticMarkup(<PrivacyPolicyPage />);
    const cateringHtml = renderToStaticMarkup(<CateringPage />);
    const notFoundHtml = renderToStaticMarkup(<NotFound />);

    expect(termsHtml).toContain('needs lawyer review');
    expect(privacyHtml).toContain('needs lawyer review');
    expect(termsHtml).toContain('var(--bg-primary)');
    expect(privacyHtml).toContain('var(--bg-primary)');
    expect(cateringHtml).toContain('var(--bg-primary)');
    expect(notFoundHtml).toContain('var(--bg-primary)');
    expect(notFoundHtml).toContain('min-h-[44px]');

    assertNoSub14pxClasses(termsHtml, '/terms');
    assertNoSub14pxClasses(privacyHtml, '/privacy');
    assertNoSub14pxClasses(cateringHtml, '/catering');
    assertNoSub14pxClasses(notFoundHtml, '/not-found');
  });

  it('5. Auth forms (LoginForm & MfaForm) render accessible labels, >=44px targets, and zero sub-14px text', () => {
    const loginHtml = renderToStaticMarkup(<LoginForm />);
    const mfaHtml = renderToStaticMarkup(<MfaForm />);

    expect(loginHtml).toContain('for="login-email"');
    expect(loginHtml).toContain('for="login-password"');
    expect(loginHtml).toContain('for="remember"');
    expect(loginHtml).toContain('id="remember"');
    expect(loginHtml).toContain('Keep me signed in for 30 days');
    expect(loginHtml).not.toMatch(/<input[^>]*id="remember"[^>]*\schecked(?:=""|(?=\s|\/?>))/);
    expect(loginHtml).toContain('min-h-[44px]');
    expect(loginHtml).toContain('var(--bg-card)');
    expect(mfaHtml).toContain('min-h-[44px]');
    expect(mfaHtml).toContain('var(--bg-card)');

    assertNoSub14pxClasses(loginHtml, 'LoginForm');
    assertNoSub14pxClasses(mfaHtml, 'MfaForm');
  });

  it('6. EventInquiryModal, StepUpVerificationModal, NotificationHistoryDrawer & PublicMenu meet Section 35 rules', () => {
    const eventModalHtml = renderToStaticMarkup(
      <EventInquiryModal isOpen={true} onClose={() => {}} />
    );
    const stepUpHtml = renderToStaticMarkup(
      <StepUpVerificationModal
        isOpen={true}
        purpose="bank_details_update"
        onSuccess={() => {}}
        onCancel={() => {}}
      />
    );
    const drawerHtml = renderToStaticMarkup(
      <NotificationHistoryDrawer orderId="ord-test-1" />
    );
    const publicMenuHtml = renderToStaticMarkup(
      <CartProvider>
        <PublicMenu />
      </CartProvider>
    );

    expect(eventModalHtml).toContain('role="dialog"');
    expect(eventModalHtml).toContain('aria-modal="true"');
    expect(eventModalHtml).toContain('w-11 h-11');
    expect(stepUpHtml).toContain('role="dialog"');
    expect(stepUpHtml).toContain('aria-modal="true"');
    expect(stepUpHtml).toContain('min-h-[44px]');
    expect(drawerHtml).toContain('min-h-[44px]');
    expect(publicMenuHtml).toContain('min-h-[44px]');

    assertNoSub14pxClasses(eventModalHtml, 'EventInquiryModal');
    assertNoSub14pxClasses(stepUpHtml, 'StepUpVerificationModal');
    assertNoSub14pxClasses(drawerHtml, 'NotificationHistoryDrawer');
    assertNoSub14pxClasses(publicMenuHtml, 'PublicMenu');
  });

  it('7. CheckoutModal and OrderTrackingView meet Section 35 semantic tokens, >=44px targets, and >=14px typography', () => {
    const checkoutModalHtml = renderToStaticMarkup(
      <CartProvider>
        <CheckoutModal isOpen={true} onClose={() => {}} onOrderPlaced={() => {}} />
      </CartProvider>
    );
    const trackingEmptyHtml = renderToStaticMarkup(
      <OrderTrackingView initialOrder={undefined} onBackToMenu={() => {}} />
    );
    const trackingActiveHtml = renderToStaticMarkup(
      <OrderTrackingView
        initialOrder={{
          id: 'ord-sec35-1',
          orderCode: 'RUC-20261117-TEST',
          customerName: 'Tunde Balogun',
          customerPhone: '+2348033729125',
          deliveryType: 'delivery',
          deliveryZoneId: 'zone-vi',
          deliveryAddress: '14 Adeola Odeku, Victoria Island, Lagos',
          deliveryFeeKobo: 300000n,
          subtotalKobo: 850000n,
          totalKobo: 1150000n,
          status: 'pending_payment',
          paymentReference: 'RUC-20261117-TEST',
          policyVersion: '2026-10-15-v3',
          policyAcceptedAt: '2026-11-17T10:00:00.000Z',
          expiresAt: '2026-11-18T17:00:00.000Z',
          createdAt: '2026-11-17T10:00:00.000Z',
          updatedAt: '2026-11-17T10:00:00.000Z',
          items: [
            {
              id: 'oi-1',
              orderId: 'ord-sec35-1',
              menuItemId: 'item-t001',
              nameSnapshot: 'Smoky Party Jollof Rice & Grilled Chicken',
              portionSnapshot: 'Regular',
              unitPriceKoboSnapshot: 850000n,
              quantity: 1,
              totalKoboSnapshot: 850000n,
            },
          ],
        }}
        onBackToMenu={() => {}}
      />
    );

    expect(checkoutModalHtml).toContain('role="dialog"');
    expect(checkoutModalHtml).toContain('var(--bg-card)');
    expect(checkoutModalHtml).toContain('w-11 h-11');
    expect(checkoutModalHtml).toContain('min-h-[44px]');
    expect(checkoutModalHtml).not.toContain('rounded-full');

    expect(trackingEmptyHtml).toContain('var(--bg-card)');
    expect(trackingEmptyHtml).toContain('min-h-[44px]');
    expect(trackingActiveHtml).toContain('var(--bg-card)');
    expect(trackingActiveHtml).toContain('w-11 h-11');
    expect(trackingActiveHtml).toContain('rounded-md');
    expect(trackingActiveHtml).not.toContain('rounded-full');

    assertNoSub14pxClasses(checkoutModalHtml, 'CheckoutModal');
    assertNoSub14pxClasses(trackingEmptyHtml, 'OrderTrackingView(empty)');
    assertNoSub14pxClasses(trackingActiveHtml, 'OrderTrackingView(active)');
  });

  it('8. /terms & /privacy Home links preserve min-w-[44px] min-h-[44px] hit target dimensions', () => {
    const termsHtml = renderToStaticMarkup(<TermsOfServicePage />);
    const privacyHtml = renderToStaticMarkup(<PrivacyPolicyPage />);

    expect(termsHtml).toContain('min-h-[44px] min-w-[44px]');
    expect(privacyHtml).toContain('min-h-[44px] min-w-[44px]');
  });

  it('9. StaffUserManager and ReconciliationManager meet Section 35 semantic tokens, >=44px targets, and GTBank copy', () => {
    const staffHtml = renderToStaticMarkup(<StaffUserManager currentUserId="usr-owner-01" />);
    const reconHtml = renderToStaticMarkup(<ReconciliationManager />);

    expect(staffHtml).toContain('Add Team Member');
    expect(staffHtml).toContain('min-h-[44px]');
    expect(reconHtml).toContain('GTBank');
    expect(reconHtml).not.toContain('Moniepoint');
    expect(reconHtml).toContain('min-h-[44px]');

    assertNoSub14pxClasses(staffHtml, 'StaffUserManager');
    assertNoSub14pxClasses(reconHtml, 'ReconciliationManager');
  });
});
