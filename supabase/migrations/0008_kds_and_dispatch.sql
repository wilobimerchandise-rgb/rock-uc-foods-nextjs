-- ============================================================================
-- ROCK UC FOODS - Phase 8 KDS & Dispatch Migration
-- 0008_kds_and_dispatch.sql
-- ============================================================================

-- 1. Kitchen Tickets Table
create table if not exists kitchen_tickets (
    id uuid primary key default gen_random_uuid(),
    order_id uuid not null references orders(id) on delete cascade,
    ticket_number text unique not null check (ticket_number ~ '^KDS-[0-9]{8}-[0-9]{4}$'),
    priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
    status text not null default 'queued' check (status in ('queued', 'cooking', 'plated', 'handed_off', 'cancelled')),
    cook_started_at timestamptz,
    plated_at timestamptz,
    handed_off_at timestamptz,
    assigned_station text check (assigned_station in ('grill', 'stew_pot', 'fryer', 'salad_prep', 'packaging')),
    created_at timestamptz not null default now(),
    constraint cooking_time_chk check (plated_at is null or cook_started_at is null or plated_at >= cook_started_at),
    constraint handoff_time_chk check (handed_off_at is null or plated_at is null or handed_off_at >= plated_at)
);

create index if not exists kitchen_tickets_order_idx on kitchen_tickets(order_id);
create index if not exists kitchen_tickets_status_idx on kitchen_tickets(status);

-- 2. Dispatch Assignments Table
create table if not exists dispatch_assignments (
    id uuid primary key default gen_random_uuid(),
    order_id uuid not null references orders(id) on delete cascade,
    rider_name text not null check (length(trim(rider_name)) >= 2),
    rider_phone text not null check (rider_phone ~ '^\+234[0-9]{10}$'),
    rider_vehicle_plate text check (rider_vehicle_plate is null or length(trim(rider_vehicle_plate)) >= 4),
    dispatch_status text not null default 'assigned' check (dispatch_status in ('assigned', 'picked_up', 'in_transit', 'delivered', 'failed')),
    picked_up_at timestamptz,
    delivered_at timestamptz,
    failed_reason text,
    customer_signature_confirmed boolean not null default false,
    created_at timestamptz not null default now(),
    constraint delivery_time_chk check (delivered_at is null or picked_up_at is null or delivered_at >= picked_up_at)
);

create index if not exists dispatch_assignments_order_idx on dispatch_assignments(order_id);
create index if not exists dispatch_assignments_status_idx on dispatch_assignments(dispatch_status);

-- RLS: Enabled
alter table kitchen_tickets enable row level security;
alter table dispatch_assignments enable row level security;

create policy kitchen_tickets_staff on kitchen_tickets
    for all using (true);

create policy dispatch_assignments_staff on dispatch_assignments
    for all using (true);

-- 3. Tracking Token Column on Orders for IDOR-Protected Customer Tracking Links
alter table orders add column if not exists tracking_token text unique check (tracking_token is null or length(trim(tracking_token)) >= 16);
create index if not exists orders_tracking_token_idx on orders(tracking_token);

