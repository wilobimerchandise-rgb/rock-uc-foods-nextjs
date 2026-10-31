-- ============================================================================
-- ROCK UC FOODS - Phase 1D: Automatic Draft Invoices from Catering Estimates
-- 0007_invoices.sql
-- ============================================================================

-- 1. Estimator Config Versions Table
create table if not exists estimator_config_versions (
    version int primary key,
    config jsonb not null,
    created_at timestamptz not null default now()
);

-- Seed initial version 1 if not exists
insert into estimator_config_versions (version, config)
values (
    1,
    '{
        "tiers": [
            {"id": "tier-bronze", "name": "Bronze Feast", "pricePerGuestKobo": 1250000, "minGuests": 20, "maxGuests": 50},
            {"id": "tier-silver", "name": "Silver Banquet", "pricePerGuestKobo": 1850000, "minGuests": 51, "maxGuests": 150},
            {"id": "tier-gold", "name": "Gold Royal", "pricePerGuestKobo": 2600000, "minGuests": 151, "maxGuests": 300},
            {"id": "tier-platinum", "name": "Platinum Sovereign", "pricePerGuestKobo": 3500000, "minGuests": 301, "maxGuests": 1000}
        ],
        "serviceRates": {
            "serviceChargeBps": 1000,
            "baseLogisticsKobo": 5000000,
            "minDepositBps": 7000
        }
    }'::jsonb
)
on conflict (version) do nothing;

-- 2. Estimates Table
create table if not exists estimates (
    id uuid primary key default gen_random_uuid(),
    config_version int references estimator_config_versions(version),
    inputs jsonb not null,
    result jsonb not null,
    contact_name text,
    contact_phone text,
    contact_email text,
    created_at timestamptz not null default now(),
    valid_until timestamptz not null
);

create index if not exists estimates_config_version_idx on estimates(config_version);
create index if not exists estimates_valid_until_idx on estimates(valid_until);

-- 3. Invoices Table (Phase 1D: Dedicated Catering Draft & Issued Invoices)
drop table if exists invoice_items cascade;
drop table if exists invoices cascade;

create table invoices (
    id uuid primary key default gen_random_uuid(),
    public_ref text unique not null check (public_ref ~ '^EVT-[0-9]{8}-[A-Z2-9]{4}$'),
    estimate_id uuid unique references estimates(id),
    revision int not null default 1 check (revision >= 1),
    status text not null default 'draft' check (status in ('draft', 'issued', 'void')),
    lines jsonb not null,
    total_kobo bigint not null check (total_kobo >= 0 and total_kobo <= 10000000000),
    deposit_kobo bigint not null check (deposit_kobo >= 0),
    balance_kobo bigint not null check (balance_kobo >= 0),
    access_token_hash text not null,
    issued_by uuid references profiles(id),
    issued_at timestamptz,
    created_at timestamptz not null default now(),
    constraint invoice_deposit_balance_chk check (deposit_kobo + balance_kobo = total_kobo)
);

do $$
begin
  if exists (select 1 from information_schema.tables where table_name = 'payment_records') then
    alter table payment_records
      drop constraint if exists payment_records_invoice_id_fkey,
      add constraint payment_records_invoice_id_fkey
      foreign key (invoice_id) references invoices(id) on delete restrict;
  end if;
end $$;

create index if not exists invoices_public_ref_idx on invoices(public_ref);
create index if not exists invoices_estimate_id_idx on invoices(estimate_id);
create index if not exists invoices_status_idx on invoices(status);

-- 4. Immutable History & Update Restrictions Trigger
create or replace function protect_invoice_immutability()
returns trigger as $$
begin
    -- Refuse any delete of issued invoices
    if old.status = 'issued' and tg_op = 'DELETE' then
        raise exception 'Issued invoices cannot be deleted (audit compliance).';
    end if;

    -- Refuse update of issued invoices (must create a new revision)
    if old.status = 'issued' and tg_op = 'UPDATE' then
        raise exception 'Issued invoices cannot be updated. Material changes require a new revision.';
    end if;

    -- For draft/void invoices, never permit changing lines, total_kobo, deposit_kobo, or balance_kobo
    if tg_op = 'UPDATE' then
        if new.lines is distinct from old.lines or
           new.total_kobo is distinct from old.total_kobo or
           new.deposit_kobo is distinct from old.deposit_kobo or
           new.balance_kobo is distinct from old.balance_kobo then
            raise exception 'Direct modification of lines, total_kobo, deposit_kobo, or balance_kobo is prohibited. Create a new revision row instead.';
        end if;
    end if;

    return new;
end;
$$ language plpgsql;

drop trigger if exists trg_protect_invoice_immutability on invoices;
create trigger trg_protect_invoice_immutability
before update or delete on invoices
for each row execute function protect_invoice_immutability();

-- 5. Row Level Security
alter table estimates enable row level security;
alter table invoices enable row level security;

-- Policies: Anonymous & customer cannot directly read or write
-- Reads and writes go through server routes
-- Owner: can select and update status
create policy estimates_owner on estimates
    for select using (auth.jwt() ->> 'role' = 'owner');

create policy invoices_owner_select on invoices
    for select using (auth.jwt() ->> 'role' in ('owner', 'staff', 'developer'));

create policy invoices_owner_update on invoices
    for update using (auth.jwt() ->> 'role' = 'owner');
