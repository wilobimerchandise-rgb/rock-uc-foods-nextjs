import React from 'react';
import {
  getProfileFromService,
  resolveSessionFromRequest,
  hasSessionVerifiedMfa,
} from '../../src/auth/wiring';
import { StaffOrderManager } from '../../src/components/order/StaffOrderManager';
import { KitchenDisplayDashboard } from '../../src/components/kds/KitchenDisplayDashboard';
import { DispatchManagerDashboard } from '../../src/components/dispatch/DispatchManagerDashboard';
import { StaffCateringManager } from '../../src/components/catering/StaffCateringManager';
import { EstimatorAdminClient } from '../../src/components/EstimatorAdminClient';
import { ReconciliationManager } from '../../src/components/payment/ReconciliationManager';
import { MfaSetupCard } from '../../src/components/security/MfaSetupCard';
import { OpsControlPanel } from '../../src/components/admin/OpsControlPanel';
import { NotificationOutboxDashboard } from '../../src/components/notifications/NotificationOutboxDashboard';
import { PromotionsAndReportsManager } from '../../src/components/promotions/PromotionsAndReportsManager';
import { OwnerMenuEditor } from '../../src/components/menu/OwnerMenuEditor';
import { StaffUserManager } from '../../src/components/admin/StaffUserManager';
import { SiteContentManager } from '../../src/components/admin/SiteContentManager';
import { DeliveryZoneManager } from '../../src/components/admin/DeliveryZoneManager';

export const dynamic = 'force-dynamic';

interface AdminPageProps {
  searchParams: Promise<{ tab?: string }>;
}

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const params = await searchParams;
  const tab = params?.tab || 'live_orders';

  const sessionRes = await resolveSessionFromRequest();
  const user = sessionRes.session?.user;
  const profile = user ? await getProfileFromService(user.id) : null;

  // Fail closed if profile is inactive, missing, or not an authorized admin/staff role
  const allowedAdminRoles = ['owner', 'staff', 'developer'] as const;
  const isAuthorizedAdmin =
    Boolean(profile) &&
    Boolean(profile?.isActive) &&
    allowedAdminRoles.includes(profile!.role as (typeof allowedAdminRoles)[number]);

  if (!isAuthorizedAdmin) {
    return (
      <div className="bg-[var(--bg-card)] border border-[var(--status-danger-border)] rounded-2xl p-6 text-center space-y-2 max-w-md mx-auto my-8">
        <h1 className="text-lg font-bold text-[var(--text-primary)]">403 Forbidden</h1>
        <p className="text-sm text-[var(--text-body-muted)]">
          An active owner, staff, or developer session is required to access the admin console.
        </p>
      </div>
    );
  }

  const role = profile!.role as 'owner' | 'staff' | 'developer';
  const userId = profile!.id;
  const hasMfaVerified = hasSessionVerifiedMfa(sessionRes.session, profile?.hasMfaVerified);

  return (
    <div className="w-full min-w-0 max-w-full">
      {tab === 'live_orders' && (
        <StaffOrderManager
          currentUserRole={role}
          currentUserId={userId}
          hasMfaVerified={hasMfaVerified}
        />
      )}
      {tab === 'kds' && <KitchenDisplayDashboard />}
      {tab === 'dispatch' && (
        <DispatchManagerDashboard
          currentUserRole={role}
          hasMfaVerified={hasMfaVerified}
        />
      )}
      {tab === 'events' && (
        <StaffCateringManager
          currentUserRole={role}
          currentUserId={userId}
          hasMfaVerified={hasMfaVerified}
        />
      )}
      {tab === 'estimator' && <EstimatorAdminClient />}
      {tab === 'reconciliation' && <ReconciliationManager />}
      {tab === 'security' && (
        <div className="space-y-6 min-w-0 max-w-full">
          <MfaSetupCard />
          <OpsControlPanel currentUserRole={role} hasMfaVerified={hasMfaVerified} />
        </div>
      )}
      {tab === 'alerts' && <NotificationOutboxDashboard />}
      {tab === 'reports' && <PromotionsAndReportsManager />}
      {tab === 'menu' && (
        <OwnerMenuEditor currentUserRole={role} currentUserId={userId} />
      )}
      {tab === 'staff' && (
        <StaffUserManager currentUserRole={role} currentUserId={userId} />
      )}
      {tab === 'zones' && (
        <DeliveryZoneManager currentUserRole={role} hasMfaVerified={hasMfaVerified} />
      )}
      {tab === 'content' && (
        <SiteContentManager currentUserRole={role} hasMfaVerified={hasMfaVerified} />
      )}
    </div>
  );
}
