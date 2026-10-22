-- ============================================================================
-- ROCK UC FOODS - Phase 7 Promotions & Reporting Migration
-- 0007_promotions_and_reports.sql
-- ============================================================================

-- 1. Promo Codes Table
create table if not exists promo_codes (
    id uuid primary key default gen_random_uuid(),
    code text unique not null check (code = upper(trim(code)) and length(code) >= 3 and length(code) <= 30),
    description text,
    discount_type text not null check (discount_type in ('percentage', 'fixed_amount')),
    discount_value bigint not null check (discount_value > 0),
    min_order_kobo bigint not null default 0 check (min_order_kobo >= 0),
    max_discount_kobo bigint check (max_discount_kobo is null or max_discount_kobo > 0),
    usage_limit int check (usage_limit is null or usage_limit > 0),
    used_count int not null default 0 check (used_count >= 0),
    start_date timestamptz not null default now(),
    end_date timestamptz not null,
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    constraint promo_date_chk check (end_date > start_date),
    constraint promo_percent_chk check (discount_type != 'percentage' or discount_value <= 100),
    constraint promo_usage_chk check (usage_limit is null or used_count <= usage_limit)
);

create index if not exists promo_codes_code_idx on promo_codes(code);
create index if not exists promo_codes_active_idx on promo_codes(is_active, start_date, end_date);

-- 2. Order Promotions Junction Table (Tracking applied promos per order)
create table if not exists order_promotions (
    id uuid primary key default gen_random_uuid(),
    order_id uuid not null references orders(id) on delete restrict,
    promo_code_id uuid not null references promo_codes(id) on delete restrict,
    discount_kobo bigint not null check (discount_kobo > 0),
    applied_at timestamptz not null default now(),
    constraint order_promo_uniq unique (order_id, promo_code_id)
);

create index if not exists order_promotions_order_idx on order_promotions(order_id);
create index if not exists order_promotions_promo_idx on order_promotions(promo_code_id);

-- RLS: Enabled
alter table promo_codes enable row level security;
alter table order_promotions enable row level security;

-- Public can read active promo codes (for checkout validation)
create policy promo_codes_read_active on promo_codes
    for select using (is_active = true);

-- Staff/Owner have full access
create policy promo_codes_manage_staff on promo_codes
    for all using (true);

create policy order_promotions_staff on order_promotions
    for all using (true);
