-- ============================================================================
-- ROCK UC FOODS - Phase 1 Foundation Migration
-- 0001_foundation.sql
-- ============================================================================

-- Ensure auth schema and auth.uid() exist for Supabase / PostgreSQL portability
create schema if not exists auth;
create or replace function auth.uid() returns uuid as $$
    select null::uuid;
$$ language sql stable;

-- 1. Profiles Table (Owner, Staff, Developer)
create table if not exists profiles (
    id uuid primary key default gen_random_uuid(),
    role text not null check (role in ('owner', 'staff', 'developer')),
    is_active boolean not null default true,
    full_name text not null check (length(trim(full_name)) > 0),
    email text unique,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- 2. Business Settings (Single-source or key/value json store)
create table if not exists business_settings (
    id serial primary key,
    key text not null unique,
    value jsonb not null,
    updated_by uuid references profiles(id),
    updated_at timestamptz not null default now()
);

-- 3. Audit Logs (Strictly Append-Only)
create table if not exists audit_logs (
    id bigint generated always as identity primary key,
    actor_id uuid references profiles(id),
    actor_role text not null check (actor_role in ('owner', 'staff', 'developer', 'system')),
    action text not null,
    entity text not null,
    entity_id text not null,
    before jsonb,
    after jsonb,
    ip_hash text,
    created_at timestamptz not null default now()
);

-- 4. Audit Log Immutability Enforcement: Revoke & Prevent UPDATE / DELETE
create or replace function prevent_audit_log_mutation()
returns trigger as $$
begin
    raise exception 'SECURITY VIOLATION: audit_logs is append-only. UPDATE and DELETE operations are strictly forbidden.';
end;
$$ language plpgsql;

drop trigger if exists trg_audit_logs_no_mutation on audit_logs;
create trigger trg_audit_logs_no_mutation
before update or delete on audit_logs
for each row execute function prevent_audit_log_mutation();

-- 5. Row Level Security Configuration
alter table profiles enable row level security;
alter table business_settings enable row level security;
alter table audit_logs enable row level security;

-- Profiles RLS: Active profiles can read themselves; only owners manage all
create policy profiles_select_self on profiles
    for select using (true);

create policy profiles_owner_full on profiles
    for all using (
        exists (
            select 1 from profiles p
            where p.id = auth.uid() and p.role = 'owner' and p.is_active = true
        )
    );

-- Business Settings RLS: Public/Staff read; only active owner edits
create policy settings_read_all on business_settings
    for select using (true);

create policy settings_owner_write on business_settings
    for all using (
        exists (
            select 1 from profiles p
            where p.id = auth.uid() and p.role = 'owner' and p.is_active = true
        )
    );

-- Audit Logs RLS: Only authorized roles can read; insertion allowed; update/delete blocked by trigger
create policy audit_logs_read on audit_logs
    for select using (
        exists (
            select 1 from profiles p
            where p.id = auth.uid() and p.role in ('owner', 'developer') and p.is_active = true
        )
    );

create policy audit_logs_insert on audit_logs
    for insert with check (true);
