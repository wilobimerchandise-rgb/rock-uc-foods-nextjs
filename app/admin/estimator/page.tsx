import React from 'react';
import { Metadata } from 'next';
import { privateMetadata } from '@/src/seo/metadata';
import { EstimatorAdminClient } from '@/src/components/EstimatorAdminClient';

export const metadata: Metadata = privateMetadata;

export default function AdminEstimatorPage() {
  return (
    <main className="min-h-screen bg-stone-100/60">
      <EstimatorAdminClient />
    </main>
  );
}
