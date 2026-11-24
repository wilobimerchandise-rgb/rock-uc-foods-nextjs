import React from 'react';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { privateMetadata } from '@/src/seo/metadata';
import { decideAdminAccess } from '@/src/auth/admin-gate';
import {
  getProfileFromService,
  resolveSessionFromRequest,
  hasSessionVerifiedMfa,
} from '@/src/auth/wiring';
import { LogoutButton } from '@/src/components/auth/LogoutButton';
import { RucLogo } from '@/src/components/brand/RucLogo';
import { AdminTabStrip } from '@/src/components/admin/AdminTabStrip';
import { ShieldCheck } from 'lucide-react';

export const metadata = privateMetadata;
export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const headersList = await headers();
  const currentPath = headersList.get('x-pathname') || '/admin';

  // Check admin access via decideAdminAccess
  const sessionRes = await resolveSessionFromRequest();
  const user = sessionRes.session?.user;

  const decision = await decideAdminAccess(
    {
      getUserProfile: async () => {
        if (!user) return null;
        const baseProfile = await getProfileFromService(user.id);
        if (!baseProfile) return null;
        return {
          ...baseProfile,
          hasMfaVerified: hasSessionVerifiedMfa(sessionRes.session, baseProfile.hasMfaVerified),
        };
      },
    },
    currentPath
  );

  if (decision.action === 'redirect') {
    redirect(decision.destination);
  }

  if (decision.action === 'forbidden') {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] flex items-center justify-center p-4 min-w-0 max-w-full">
        <div className="max-w-md w-full bg-[var(--bg-card)] border border-[var(--status-danger-border)] rounded-2xl p-6 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-[var(--status-danger-bg)] border border-[var(--status-danger-border)] flex items-center justify-center mx-auto text-[var(--status-danger-text)] font-bold text-lg">
            !
          </div>
          <h1 className="text-xl font-bold text-[var(--text-primary)]">403 Forbidden</h1>
          <p className="text-sm text-[var(--text-body-muted)]">{decision.reason}</p>
          <div className="pt-2 flex justify-center">
            <LogoutButton />
          </div>
        </div>
      </div>
    );
  }

  const profile = decision.profile;

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] flex flex-col font-sans min-w-0 max-w-full">
      {/* Admin Top Navigation Banner */}
      <header className="border-b border-[var(--border-card)] bg-[var(--bg-header)] backdrop-blur sticky top-0 z-40 px-4 py-2.5 min-w-0 w-full max-w-full">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-2.5 min-w-0 w-full">
          <div className="flex items-center gap-3 min-w-0">
            <RucLogo size={36} showWordmark={true} />
            <div className="hidden sm:flex items-center gap-1.5 pl-3 border-l border-[var(--border-subtle-card)] text-sm">
              <span className="text-[var(--text-body-muted)]">Admin Portal</span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <div className="flex items-center gap-1.5 px-3 min-h-[44px] rounded-lg bg-[var(--bg-primary)] border border-[var(--border-subtle-card)] text-sm">
              <ShieldCheck className="w-4 h-4 text-[var(--text-accent)] shrink-0" />
              <span className="text-[var(--text-body-muted)] hidden sm:inline">Role:</span>
              <span className="font-bold text-[var(--text-accent)] uppercase">{profile.role}</span>
            </div>
            <LogoutButton />
          </div>
        </div>
      </header>

      {/* Admin 10-Tab Strip Container (Section 27.1) */}
      <AdminTabStrip />

      {/* Admin Page Content with bottom clearance for floating chat button */}
      <main className="flex-1 p-4 sm:p-6 max-w-6xl mx-auto w-full min-w-0 max-w-full pb-[calc(6rem+env(safe-area-inset-bottom,0px))]">
        {children}
      </main>
    </div>
  );
}
