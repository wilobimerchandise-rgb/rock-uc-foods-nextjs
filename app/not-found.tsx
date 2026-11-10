import React from 'react';
import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="min-h-screen bg-[#0B0A09] text-[#F7EFD9] flex flex-col items-center justify-center p-6 text-center">
      <div className="max-w-md space-y-4">
        <span className="text-xs uppercase tracking-widest text-[#D4AF37] font-semibold">404 — Page Not Found</span>
        <h1 className="text-3xl font-bold tracking-tight text-white">This dish isn&apos;t on the menu</h1>
        <p className="text-sm text-[#F7EFD9]/70">
          The page or document you are looking for does not exist or may have expired.
        </p>
        <div className="pt-4">
          <Link
            href="/"
            className="inline-block px-6 py-2.5 rounded-full bg-[#D4AF37] text-[#0B0A09] font-medium hover:bg-[#F3D98B] transition-colors"
          >
            Return to Homepage
          </Link>
        </div>
      </div>
    </main>
  );
}
