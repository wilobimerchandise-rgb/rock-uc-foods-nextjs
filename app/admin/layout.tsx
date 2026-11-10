import React from 'react';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { privateMetadata } from '@/src/seo/metadata';
import { decideAdminAccess } from '@/src/auth/admin-gate';
import { globalAuthService, getProfileFromService } from '@/src/auth/wiring';
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
  const sessionRes = await globalAuthService.getSession();
  const user = sessionRes.session?.user;

  const decision = await decideAdminAccess(
    {
      getUserProfile: async () => {
        if (!user) return null;
        return getProfileFromService(user.id);
      },
    },
    currentPath
  );

  if (decision.action === 'redirect') {
    redirect(decision.destination);
  }

  if (decision.action === 'forbidden') {
    return (
      <div className="min-h-screen bg-[#0B0A09] text-[#F7EFD9] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-[#17120F] border border-[#B3261E]/40 rounded-2xl p-6 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto text-red-400">
            !
          </div>
          <h1 className="text-xl font-bold text-white">403 Forbidden</h1>
          <p className="text-xs text-white/60">{decision.reason}</p>
          <div className="pt-2">
            <LogoutButton />
          </div>
        </div>
      </div>
    );
  }

  const profile = decision.profile;

  return (
    <div className="min-h-screen bg-[#0B0A09] text-[#F7EFD9] flex flex-col font-sans min-w-0 max-w-full">
      {/* Admin Top Navigation Banner */}
      <header className="border-b border-[#D4AF37]/30 bg-[#17120F]/90 backdrop-blur sticky top-0 z-40 px-4 py-2.5 min-w-0 w-full max-w-full">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3 min-w-0 w-full">
          <div className="flex items-center gap-3 min-w-0">
            <RucLogo size={36} showWordmark={true} />
            <div className="hidden sm:flex items-center gap-1.5 pl-3 border-l border-white/10 text-xs">
              <span className="text-white/50">Admin Portal</span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#0B0A09] border border-white/10 text-xs">
              <ShieldCheck className="w-3.5 h-3.5 text-[#D4AF37]" />
              <span className="text-[#F7EFD9]/60">Role:</span>
              <span className="font-bold text-[#D4AF37] uppercase text-[11px]">{profile.role}</span>
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
