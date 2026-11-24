import React from 'react';
import { Metadata } from 'next';
import { privateMetadata } from '@/src/seo/metadata';
import { ReconciliationManager } from '@/src/components/payment/ReconciliationManager';

export const metadata: Metadata = privateMetadata;

export default function AdminReconciliationPage() {
  return (
    <div className="w-full min-w-0 max-w-full py-2">
      <div className="max-w-6xl mx-auto min-w-0">
        <ReconciliationManager />
      </div>
    </div>
  );
}
