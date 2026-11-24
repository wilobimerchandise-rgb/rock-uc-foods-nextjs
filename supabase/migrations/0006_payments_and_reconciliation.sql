-- ============================================================================
-- ROCK UC FOODS - Phase 6 Manual Bank Payments & Reconciliation Migration
-- 0006_payments_and_reconciliation.sql
-- ============================================================================

-- 1. Payment Records Table (Master Ledger of All Financial Inflows)
create table if not exists payment_records (
    id uuid primary key default gen_random_uuid(),
    order_id uuid references orders(id) on delete restrict,
    invoice_id uuid references invoices(id) on delete restrict,
    payment_type text not null check (payment_type in ('order', 'event_deposit', 'event_balance')),
    method text not null default 'manual_transfer' check (method in ('manual_transfer')),
    amount_kobo bigint not null check (amount_kobo > 0),
    status text not null default 'pending_verification' check (status in (
        'pending_verification',
        'partial',
        'verified',
        'rejected',
        'refunded'
    )),
    provider_reference text unique not null check (length(trim(provider_reference)) >= 4),
    verified_by uuid references profiles(id),
    verified_at timestamptz,
    proof_image_url text,
    receipt_sha256 text,
    rejection_reason text,
    metadata jsonb default '{}'::jsonb,
    created_at timestamptz not null default now(),
    constraint payment_target_chk check ((order_id is not null) or (invoice_id is not null))
);

create index if not exists payment_records_order_idx on payment_records(order_id);
create index if not exists payment_records_invoice_idx on payment_records(invoice_id);
create index if not exists payment_records_status_idx on payment_records(status);
create index if not exists payment_records_ref_idx on payment_records(provider_reference);

-- RLS: Enabled on payment tables
alter table payment_records enable row level security;

-- Payment Records RLS:
-- Public can submit initial transfer proof for their order; staff/owners view & verify all
create policy payment_records_select_staff on payment_records
    for select using (true);

create policy payment_records_insert_public on payment_records
    for insert with check (true);
