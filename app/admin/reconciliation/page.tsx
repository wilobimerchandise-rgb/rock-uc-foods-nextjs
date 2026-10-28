import React from 'react';
import { Metadata } from 'next';
import { privateMetadata } from '@/src/seo/metadata';
import { ReconciliationManager } from '@/src/components/payment/ReconciliationManager';

export const metadata: Metadata = privateMetadata;

export default function AdminReconciliationPage() {
  return (
    <main className="min-h-screen bg-[#0B0A09] text-[#F7EFD9] p-6">
      <div className="max-w-6xl mx-auto">
        <ReconciliationManager />
      </div>
    </main>
  );
}
