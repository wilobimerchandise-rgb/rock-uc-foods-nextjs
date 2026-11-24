# ROCK UC FOODS: Production Engineering Playbook (v2 Sync)

Updated against repository state (`0001`–`0022` migrations, manual GTBank transfer verification & DB-backed ops controls).

## 1. Architecture & Stack
- **Framework**: Next.js 15+ (App Router), React, TypeScript, Tailwind CSS v4.
- **Database & Auth**: Supabase (PostgreSQL with Row Level Security across migrations `0001_foundation.sql` through `0022_manual_gtbank_and_db_ops_settings.sql`, Supabase Auth with RFC 6238 TOTP MFA & step-up enforcement).
- **Payments & Reconciliation**: Manual Nigerian bank transfer (Guaranty Trust Bank (GTBank), owner-verified in `src/lib/businessSettings.ts` and `business_settings`) + bank CSV statement reconciliation (`src/payment/reconciliation.ts`). Zero external payment gateways.
- **Documents & PDFs**: Server-side branded A4 PDF invoices and receipts (`INV-YYYY-000123`, `RCT-YYYY-000123`) using ₦ (`U+20A6`, never `NGN`).

## 2. Core Invariants (Non-Negotiable)

### Money (`bigint` Kobo)
- Every monetary value is stored and computed in integer kobo (`bigint`, columns named `*_kobo`). Never `float`, `numeric`, or `double`.
- All totals, deposits (`70%`), balances (`30%`), delivery fees, and discounts are recomputed server-side from authoritative DB/config inputs.
- User-entered amounts are parsed via strict integer arithmetic (`parseNairaToKobo`), rejecting negatives, `> 2` decimal places, non-numeric input, and values above `MAX_KOBO`.
- Display uses `₦` (`U+20A6`) with thousands separators (`formatNaira`). Never display `NGN`.

### Security, Privacy & Access Control
- **Fail-Closed Admin**: `/admin` routes (`app/admin/layout.tsx`, `app/admin/page.tsx`, `/api/admin/*`) enforce active `owner`, `staff`, or `developer` roles with zero fallback escalation.
- **Second-Factor Owner Operations**: Issuing invoices, revising invoices, toggling kill switches, configuring bank details, running drills, and preparing WhatsApp share links require `owner` role + verified TOTP MFA.
- **Customer Phone Masking (Finding 9)**: `staff` accounts and unverified MFA sessions view masked digits (`+234 *** *** 9125`); full unmasked phone numbers require verified MFA on `owner`/`developer` accounts.
- **Token Security**: Public order tracking & invoice links use random 128-bit/256-bit tokens (`30`-day invoice share links stored strictly as 64-char SHA-256 hashes in `invoice_links`).
- **Verified Bank Details Gate (Finding 6)**: Issuing or preparing WhatsApp share links is blocked (`409`) unless owner-verified bank transfer details are configured; unconfigured views show `"Payment details will be sent by ROCK UC FOODS."`.
- **Zero PII in Logs & Audits**: Never log or audit customer phone numbers, emails, addresses, raw tokens, or payment payloads. Audit logs are append-only.
- **NDPA 90-Day Retention**: `src/lib/ndpaRetention.ts` redacts customer phones/emails to `[REDACTED_NDPA]` after 90 days on terminal orders, expired estimates, and outbox notifications while retaining financial kobo totals.

### Expiry, Alerts & Operational Resilience (Section 31.6)
- **7-Hour Order Expiry**: Unconfirmed `pending_payment` orders expire automatically after 7 hours.
- **48-Hour Estimate Validity**: Estimates expire after 48 hours; expired estimates block both draft creation and owner issuance (`Finding 5`), and stale expired drafts auto-void on listing (`Finding 8`).
- **Kill Switches**: Admin-only database settings (`ops_settings` toggles for `invoiceRequestsPaused` and `whatsappSendPaused` via `/api/admin/ops` and `OpsControlPanel`) fail closed with HTTP `503` and WhatsApp/SMS fallback guidance.
- **Proactive Monitoring**: Stale draft alerts (`> 2 hours`), audit write failure monitoring, nightly invoice self-check (`src/invoices/selfCheck.ts`), and fault-injection drills (`src/lib/drills.ts`).

## 3. Verification Gate
Run before every release or phase sign-off:
1. `npx tsc --noEmit` (0 errors)
2. `npm run verify` (`node scripts/verify.mjs` — TypeScript + full Vitest suite + secret scan, outputs `VERIFICATION_REPORT.md`)
3. `npm run build` (`NODE_ENV=production next build`)
4. `npm run lint` (`eslint .`, 0 errors)
