import React from 'react';
import { Metadata } from 'next';
import { privateMetadata } from '@/src/seo/metadata';
import { EstimatorAdminClient } from '@/src/components/EstimatorAdminClient';

export const metadata: Metadata = privateMetadata;

export default function AdminEstimatorPage() {
  return (
    <div className="w-full min-w-0 max-w-full">
      <EstimatorAdminClient />
    </div>
  );
}
