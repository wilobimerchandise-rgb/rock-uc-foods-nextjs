import React from 'react';
import { globalAuthService, getProfileFromService } from '@/src/auth/wiring';
import { StaffOrderManager } from '@/src/components/order/StaffOrderManager';
import { KitchenDisplayDashboard } from '@/src/components/kds/KitchenDisplayDashboard';
import { DispatchManagerDashboard } from '@/src/components/dispatch/DispatchManagerDashboard';
import { StaffCateringManager } from '@/src/components/catering/StaffCateringManager';
import { EstimatorAdminClient } from '@/src/components/EstimatorAdminClient';
import { ReconciliationManager } from '@/src/components/payment/ReconciliationManager';
import { MfaSetupCard } from '@/src/components/security/MfaSetupCard';
import { NotificationOutboxDashboard } from '@/src/components/notifications/NotificationOutboxDashboard';
import { PromotionsAndReportsManager } from '@/src/components/promotions/PromotionsAndReportsManager';
import { OwnerMenuEditor } from '@/src/components/menu/OwnerMenuEditor';
import { StaffUserManager } from '@/src/components/admin/StaffUserManager';

export const dynamic = 'force-dynamic';

interface AdminPageProps {
  searchParams: Promise<{ tab?: string }>;
}

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const params = await searchParams;
  const tab = params?.tab || 'live_orders';

  const sessionRes = await globalAuthService.getSession();
  const user = sessionRes.session?.user;
  const profile = user ? await getProfileFromService(user.id) : null;
  const role: 'owner' | 'staff' | 'developer' =
    profile?.role === 'staff' || profile?.role === 'developer'
      ? profile.role
      : 'owner';
  const userId = user?.id || 'admin-user';

  return (
    <div className="w-full min-w-0 max-w-full">
      {tab === 'live_orders' && (
        <StaffOrderManager currentUserRole={role} currentUserId={userId} />
      )}
      {tab === 'kds' && <KitchenDisplayDashboard />}
      {tab === 'dispatch' && <DispatchManagerDashboard />}
      {tab === 'events' && (
        <StaffCateringManager currentUserRole={role} currentUserId={userId} />
      )}
      {tab === 'estimator' && <EstimatorAdminClient />}
      {tab === 'reconciliation' && <ReconciliationManager />}
      {tab === 'security' && <MfaSetupCard />}
      {tab === 'alerts' && <NotificationOutboxDashboard />}
      {tab === 'reports' && <PromotionsAndReportsManager />}
      {tab === 'menu' && (
        <OwnerMenuEditor currentUserRole={role} currentUserId={userId} />
      )}
      {tab === 'staff' && (
        <StaffUserManager currentUserRole={role} currentUserId={userId} />
      )}
    </div>
  );
}
