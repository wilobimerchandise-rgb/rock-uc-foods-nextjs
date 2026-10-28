import React from 'react';
import { Metadata } from 'next';
import { publicMetadata } from '@/src/seo/metadata';
import { EstimatorClient } from '@/src/components/EstimatorClient';

export const metadata: Metadata = publicMetadata({
  title: 'Catering Cost Estimator | ROCK UC FOODS',
  description: 'Calculate instant transparent party and event catering costs in Lagos. 70/30 deposit terms with luxury service.',
  path: '/estimate',
});

export default function EstimatePage() {
  return (
    <main className="min-h-screen bg-[#FDFBF7]">
      <EstimatorClient />
    </main>
  );
}
