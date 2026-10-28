-- ============================================================================
-- ROCK UC FOODS - Phase 2: Payment Webhooks & Bank Reconciliation
-- 0011_webhooks_and_reconciliation.sql
-- Idempotent webhook storage and bank statement reconciliation ledgers
-- ============================================================================

-- 1. Webhook processing ledger for replay protection
create table if not exists payment_webhooks_processed (
    id text primary key,
    provider text not null default 'paystack',
    event_type text not null,
    reference text not null unique,
    payload jsonb not null,
    processed_at timestamptz not null default now()
);

-- 2. Bank reconciliation batches
create table if not exists bank_reconciliation_batches (
    id uuid primary key default gen_random_uuid(),
    filename text not null,
    bank_name text not null default 'Moniepoint',
    total_records integer not null default 0,
    total_amount_kobo bigint not null default 0,
    matched_amount_kobo bigint not null default 0,
    unmatched_amount_kobo bigint not null default 0,
    uploaded_by text not null default 'owner@rockucfoods.com',
    created_at timestamptz not null default now()
);

-- 3. Bank reconciliation transaction lines
create table if not exists bank_reconciliation_lines (
    id uuid primary key default gen_random_uuid(),
    batch_id uuid references bank_reconciliation_batches(id) on delete cascade,
    txn_date date not null,
    narration text not null,
    amount_kobo bigint not null,
    extracted_ref text,
    status text not null check (status in ('reconciled_exact', 'underpaid', 'overpaid', 'already_paid', 'unmatched')),
    matched_order_id uuid references orders(id),
    matched_invoice_id uuid references invoices(id),
    reconciled_at timestamptz,
    reconciled_by text,
    created_at timestamptz not null default now()
);

create index if not exists idx_wh_processed_ref on payment_webhooks_processed(reference);
create index if not exists idx_recon_lines_batch on bank_reconciliation_lines(batch_id);
create index if not exists idx_recon_lines_status on bank_reconciliation_lines(status);
