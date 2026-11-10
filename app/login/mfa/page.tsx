import { Suspense } from 'react';
import { privateMetadata } from '@/src/seo/metadata';
import { MfaForm } from '@/src/components/auth/MfaForm';

export const metadata = privateMetadata;
export const dynamic = 'force-dynamic';

export default function MfaPage() {
  return (
    <main className="min-h-screen bg-[#0B0A09] text-[#F7EFD9] flex items-center justify-center p-4">
      <Suspense fallback={<div className="text-center text-sm text-[#F7EFD9]/50">Loading verification...</div>}>
        <MfaForm />
      </Suspense>
    </main>
  );
}
