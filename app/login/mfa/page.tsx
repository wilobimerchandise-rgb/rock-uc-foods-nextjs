import { Suspense } from 'react';
import { privateMetadata } from '@/src/seo/metadata';
import { MfaForm } from '@/src/components/auth/MfaForm';

export const metadata = privateMetadata;
export const dynamic = 'force-dynamic';

export default function MfaPage() {
  return (
    <main className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] flex items-center justify-center p-4 sm:p-6 min-w-0 max-w-full">
      <Suspense fallback={<div className="text-center text-sm text-[var(--text-body-muted)]">Loading verification...</div>}>
        <MfaForm />
      </Suspense>
    </main>
  );
}
