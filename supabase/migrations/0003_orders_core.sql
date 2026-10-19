-- ============================================================================
-- ROCK UC FOODS - Phase 3 Orders & Delivery Core Migration
-- 0003_orders_core.sql
-- ============================================================================

-- 1. Delivery Zones Table
create table if not exists delivery_zones (
    id uuid primary key default gen_random_uuid(),
    code text unique not null,
    name text not null,
    areas text[] not null default '{}',
    fee_kobo bigint not null check (fee_kobo >= 0 and fee_kobo <= 500000000), -- max ₦5,000,000
    is_active boolean not null default true,
    sort_order int not null default 0,
    created_at timestamptz not null default now()
);

-- Seed Initial Lagos Delivery Zones (Strict integer kobo)
insert into delivery_zones (code, name, areas, fee_kobo, sort_order)
values
    ('ZONE_1', 'Zone 1: Ikeja & Environs', array['Ikeja', 'Maryland', 'Opebi', 'Allen', 'Ojodu', 'Alausa'], 250000, 1),
    ('ZONE_2', 'Zone 2: Island Core', array['Victoria Island', 'Ikoyi', 'Lekki Phase 1', 'Oniru'], 350000, 2),
    ('ZONE_3', 'Zone 3: Central Mainland', array['Surulere', 'Yaba', 'Gbagada', 'Magodo', 'Anthony', 'Ilpeju'], 300000, 3),
    ('ZONE_4', 'Zone 4: Greater Island', array['Lekki beyond Chevron', 'Ajah', 'Sangotedo', 'Jakande'], 450000, 4),
    ('ZONE_5', 'Zone 5: Outer Mainland', array['Festac', 'Amuwo', 'Alimosho', 'Ikorodu', 'Agege'], 500000, 5)
on conflict (code) do nothing;

-- 2. Orders Table
create table if not exists orders (
    id uuid primary key default gen_random_uuid(),
    order_code text unique not null check (order_code ~ '^RUC-[0-9]{8}-[A-Z0-9]{4}$'),
    customer_name text not null check (length(customer_name) between 2 and 100),
    customer_phone text not null check (customer_phone ~ '^\+234[0-9]{10}$'),
    customer_email text check (customer_email is null or length(customer_email) <= 100),
    delivery_type text not null check (delivery_type in ('delivery', 'collection')),
    delivery_zone_id uuid references delivery_zones(id),
    delivery_address text check (delivery_type = 'collection' or (delivery_address is not null and length(delivery_address) >= 5)),
    delivery_fee_kobo bigint not null check (delivery_fee_kobo >= 0),
    subtotal_kobo bigint not null check (subtotal_kobo > 0),
    total_kobo bigint not null,
    status text not null default 'pending_payment' check (status in (
        'pending_payment',
        'payment_confirmed',
        'in_kitchen',
        'ready_for_dispatch',
        'out_for_delivery',
        'delivered',
        'cancelled'
    )),
    special_instructions text check (special_instructions is null or length(special_instructions) <= 500),
    policy_version text not null,
    policy_accepted_at timestamptz not null default now(),
    payment_verified_at timestamptz,
    payment_verified_by uuid references profiles(id),
    payment_reference text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint orders_total_reconciliation_chk check (total_kobo = subtotal_kobo + delivery_fee_kobo)
);

create index if not exists orders_order_code_idx on orders(order_code);
create index if not exists orders_customer_phone_idx on orders(customer_phone);
create index if not exists orders_status_idx on orders(status);
create index if not exists orders_created_at_idx on orders(created_at desc);

-- 3. Order Items Table (Immutable Snapshot of Menu Items at checkout)
create table if not exists order_items (
    id uuid primary key default gen_random_uuid(),
    order_id uuid not null references orders(id) on delete cascade,
    menu_item_id uuid not null references menu_items(id) on delete restrict,
    name_snapshot text not null,
    portion_snapshot text,
    unit_price_kobo_snapshot bigint not null check (unit_price_kobo_snapshot >= 0),
    quantity int not null check (quantity > 0 and quantity <= 100),
    total_kobo_snapshot bigint not null,
    created_at timestamptz not null default now(),
    constraint order_items_total_snapshot_chk check (total_kobo_snapshot = unit_price_kobo_snapshot * quantity)
);

create index if not exists order_items_order_id_idx on order_items(order_id);
