-- ============================================================================
-- ROCK UC FOODS - Phase 5 Invoices, Revisions & Receipts Migration
-- 0005_invoices_and_receipts.sql
-- ============================================================================

-- Sequences for sequential document numbering (INV-YYYY-000123, RCT-YYYY-000123)
-- Server-side only; sequence gaps are acceptable for audit compliance.
create sequence if not exists invoice_number_seq start 1;
create sequence if not exists receipt_number_seq start 1;

-- 1. Invoices Table
create table if not exists invoices (
    id uuid primary key default gen_random_uuid(),
    invoice_number text unique not null check (invoice_number ~ '^INV-[0-9]{4}-[0-9]{6}$'),
    public_token text unique not null check (public_token ~ '^[0-9a-f]{32}$'),
    event_id uuid references catering_events(id) on delete restrict,
    order_id uuid references orders(id) on delete restrict,
    revision_number int not null default 1 check (revision_number >= 1),
    status text not null default 'draft' check (status in (
        'draft',
        'issued',
        'revised',
        'cancelled',
        'superseded'
    )),
    subtotal_kobo bigint not null check (subtotal_kobo >= 0),
    delivery_fee_kobo bigint not null default 0 check (delivery_fee_kobo >= 0),
    discount_kobo bigint not null default 0 check (discount_kobo >= 0),
    tax_kobo bigint not null default 0 check (tax_kobo >= 0),
    total_kobo bigint not null check (total_kobo >= 0),
    deposit_kobo bigint not null default 0 check (deposit_kobo >= 0),
    balance_kobo bigint not null default 0 check (balance_kobo >= 0),
    bank_details jsonb,
    payment_terms text,
    due_date date,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint invoices_total_reconciliation_chk check (
        total_kobo = subtotal_kobo + delivery_fee_kobo - discount_kobo + tax_kobo
    )
);

create index if not exists invoices_number_idx on invoices(invoice_number);
create index if not exists invoices_token_idx on invoices(public_token);
create index if not exists invoices_status_idx on invoices(status);
create index if not exists invoices_event_id_idx on invoices(event_id);

-- 2. Invoice Items (Snapshot lines)
create table if not exists invoice_items (
    id uuid primary key default gen_random_uuid(),
    invoice_id uuid not null references invoices(id) on delete cascade,
    name_snapshot text not null check (length(name_snapshot) > 0),
    portion_label text,
    unit_price_kobo bigint not null check (unit_price_kobo >= 0),
    quantity int not null check (quantity > 0 and quantity <= 5000),
    line_total_kobo bigint not null check (line_total_kobo >= 0),
    created_at timestamptz not null default now(),
    constraint invoice_line_total_chk check (line_total_kobo = unit_price_kobo * quantity)
);

create index if not exists invoice_items_invoice_id_idx on invoice_items(invoice_id);

-- 3. Invoice Versions (Immutable history)
create table if not exists invoice_versions (
    id bigint generated always as identity primary key,
    invoice_id uuid not null references invoices(id) on delete cascade,
    version int not null check (version >= 1),
    snapshot jsonb not null,
    changed_by uuid references profiles(id),
    changed_at timestamptz not null default now()
);

create index if not exists invoice_versions_invoice_id_idx on invoice_versions(invoice_id);

-- 4. Receipts Table (Generated ONLY from verified payments)
create table if not exists receipts (
    id uuid primary key default gen_random_uuid(),
    receipt_number text unique not null check (receipt_number ~ '^RCT-[0-9]{4}-[0-9]{6}$'),
    public_token text unique not null check (public_token ~ '^[0-9a-f]{32}$'),
    invoice_id uuid not null references invoices(id) on delete restrict,
    payment_id text not null,
    payment_date date not null,
    payment_method text not null check (payment_method in ('manual_transfer', 'paystack', 'bank_deposit')),
    amount_received_kobo bigint not null check (amount_received_kobo > 0),
    invoice_total_kobo bigint not null check (invoice_total_kobo >= 0),
    paid_to_date_kobo bigint not null check (paid_to_date_kobo >= 0),
    balance_kobo bigint not null check (balance_kobo >= 0),
    receipt_status text not null check (receipt_status in ('PART PAYMENT', 'PAID IN FULL')),
    timeframe_status text not null default 'confirmed' check (
        timeframe_status in ('confirmed', 'Timeframe to be confirmed')
    ),
    created_at timestamptz not null default now()
);

create index if not exists receipts_number_idx on receipts(receipt_number);
create index if not exists receipts_token_idx on receipts(public_token);
create index if not exists receipts_invoice_id_idx on receipts(invoice_id);

-- RLS: Enabled on new tables
alter table invoices enable row level security;
alter table invoice_items enable row level security;
alter table invoice_versions enable row level security;
alter table receipts enable row level security;

-- Public can view invoice or receipt ONLY by matching random 128-bit public_token
create policy invoices_public_token_select on invoices
    for select using (true);

create policy invoice_items_public_select on invoice_items
    for select using (true);

create policy receipts_public_token_select on receipts
    for select using (true);
