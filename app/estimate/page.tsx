import React from 'react';
import Link from 'next/link';
import { Metadata } from 'next';
import { publicMetadata } from '@/src/seo/metadata';
import { EstimatorClient } from '@/src/components/EstimatorClient';
import { ContactFooter } from '@/src/components/brand/ContactFooter';
import { getEstimatorConfig, serializeEstimatorConfig } from '@/src/estimator/config';

export const metadata: Metadata = publicMetadata({
  title: 'Catering Cost Estimator | ROCK UC FOODS',
  description: 'Calculate instant transparent party and event catering costs in Lagos. 70/30 deposit terms with luxury service.',
  path: '/estimate',
});

export const dynamic = 'force-dynamic';

interface EstimatePageProps {
  searchParams: Promise<{ tier?: string }>;
}

export default async function EstimatePage({ searchParams }: EstimatePageProps) {
  const params = await searchParams;
  const serializedConfig = serializeEstimatorConfig(getEstimatorConfig());

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] flex flex-col font-sans min-w-0 max-w-full">
      <header className="border-b border-[var(--border-card)] bg-[var(--bg-header)] backdrop-blur sticky top-0 z-40 px-4 py-2 min-w-0">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
          <Link
            href="/"
            className="min-h-[44px] inline-flex items-center font-serif font-bold text-lg text-[var(--text-primary)] tracking-wider"
          >
            ROCK UC FOODS
          </Link>
          <div className="flex items-center gap-2 sm:gap-3 text-sm">
            <Link
              href="/menu"
              className="hidden sm:inline-flex items-center min-h-[44px] px-2 text-[var(--text-body-muted)] hover:text-[var(--text-accent)] transition-colors"
            >
              Public Menu
            </Link>
            <Link
              href="/catering"
              className="min-h-[44px] inline-flex items-center justify-center bg-[#6B1230] text-[#F7EFD9] border border-[#D4AF37]/60 px-3.5 py-2 rounded-lg font-semibold hover:bg-[#82173B] transition-all whitespace-nowrap"
            >
              Catering Packages
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 min-w-0 w-full">
        <EstimatorClient
          initialTierId={params?.tier}
          initialConfig={serializedConfig}
        />
      </main>

      <ContactFooter />
    </div>
  );
}
