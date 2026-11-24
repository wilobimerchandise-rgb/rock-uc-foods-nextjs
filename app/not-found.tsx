import React from 'react';
import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] flex flex-col items-center justify-center p-6 text-center">
      <div className="max-w-md space-y-4 bg-[var(--bg-card)] border border-[var(--border-card)] rounded-2xl p-8 shadow-xl">
        <span className="text-sm uppercase tracking-widest text-[var(--text-accent)] font-semibold block">
          404 — Page Not Found
        </span>
        <h1 className="text-3xl font-serif font-bold tracking-tight text-[var(--text-primary)]">
          This dish isn&apos;t on the menu
        </h1>
        <p className="text-sm text-[var(--text-body-muted)] leading-relaxed">
          The page or document you are looking for does not exist or may have expired.
        </p>
        <div className="pt-2">
          <Link
            href="/"
            className="min-h-[44px] inline-flex items-center justify-center px-6 py-2.5 rounded-lg bg-[var(--cta-gold-bg)] hover:bg-[var(--cta-gold-hover)] text-[var(--cta-gold-text)] text-sm font-bold transition-colors focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)]"
          >
            Return to Homepage
          </Link>
        </div>
      </div>
    </main>
  );
}
