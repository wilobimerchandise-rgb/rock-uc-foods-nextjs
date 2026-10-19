-- ============================================================================
-- ROCK UC FOODS - Phase 4 Events & Bulk Catering Invoices Migration
-- 0004_events_and_invoices.sql
-- ============================================================================

-- 1. Catering Events Table
create table if not exists catering_events (
    id uuid primary key default gen_random_uuid(),
    event_code text unique not null check (event_code ~ '^EVT-[0-9]{8}-[A-Z0-9]{4}$'),
    client_name text not null check (length(client_name) between 2 and 100),
    client_phone text not null check (client_phone ~ '^\+234[0-9]{10}$'),
    client_email text,
    event_type text not null,
    event_date date not null,
    guest_count int not null check (guest_count >= 10 and guest_count <= 5000),
    venue_address text not null check (length(venue_address) >= 5),
    live_cooking_requested boolean not null default false,
    special_notes text,
    status text not null default 'inquiry' check (status in (
        'inquiry',
        'quote_sent',
        'deposit_paid',
        'fully_paid',
        'in_prep',
        'completed',
        'cancelled'
    )),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists catering_events_code_idx on catering_events(event_code);
create index if not exists catering_events_date_idx on catering_events(event_date);
create index if not exists catering_events_status_idx on catering_events(status);

-- 2. Catering Quotes Table with Immutable Revision Tracking & Deposit Schedule
create table if not exists catering_quotes (
    id uuid primary key default gen_random_uuid(),
    event_id uuid not null references catering_events(id) on delete cascade,
    revision_number int not null default 1 check (revision_number >= 1),
    food_subtotal_kobo bigint not null check (food_subtotal_kobo >= 0),
    logistics_fee_kobo bigint not null default 0 check (logistics_fee_kobo >= 0),
    service_fee_kobo bigint not null default 0 check (service_fee_kobo >= 0),
    total_kobo bigint not null check (total_kobo >= 0),
    deposit_percentage int not null default 70 check (deposit_percentage between 10 and 100),
    deposit_kobo bigint not null check (deposit_kobo >= 0),
    balance_kobo bigint not null check (balance_kobo >= 0),
    deposit_status text not null default 'unpaid' check (deposit_status in ('unpaid', 'paid', 'refunded')),
    balance_status text not null default 'unpaid' check (balance_status in ('unpaid', 'paid')),
    deposit_paid_at timestamptz,
    balance_paid_at timestamptz,
    deposit_verified_by uuid references profiles(id),
    balance_verified_by uuid references profiles(id),
    status text not null default 'active' check (status in ('draft', 'active', 'superseded', 'cancelled')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint quotes_schedule_reconciliation_chk check (total_kobo = deposit_kobo + balance_kobo),
    constraint quotes_subtotal_sum_chk check (total_kobo = food_subtotal_kobo + logistics_fee_kobo + service_fee_kobo)
);

create unique index if not exists catering_quotes_event_rev_uq on catering_quotes(event_id, revision_number);
create index if not exists catering_quotes_event_id_idx on catering_quotes(event_id);

-- 3. Quote Line Items (Itemized menu line breakdown)
create table if not exists quote_line_items (
    id uuid primary key default gen_random_uuid(),
    quote_id uuid not null references catering_quotes(id) on delete cascade,
    name text not null,
    portion_label text,
    description text,
    unit_price_kobo bigint not null check (unit_price_kobo >= 0),
    quantity int not null check (quantity > 0 and quantity <= 5000),
    total_kobo bigint not null,
    created_at timestamptz not null default now(),
    constraint quote_line_total_chk check (total_kobo = unit_price_kobo * quantity)
);

create index if not exists quote_line_items_quote_id_idx on quote_line_items(quote_id);
