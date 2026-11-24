-- ============================================================================
-- ROCK UC FOODS - Manual GTBank Transfer & DB-Backed Ops Settings Migration
-- 0022_manual_gtbank_and_db_ops_settings.sql
-- ============================================================================

-- 1. Drop legacy Paystack/webhook artifacts if they existed in prior deployments
drop table if exists webhook_events cascade;
drop table if exists payment_webhooks_processed cascade;

-- 2. Upgrade orders table for manual bank transfer flow, 7h expiry, partial payments, and reopen audit
alter table if exists orders
    add column if not exists paid_amount_kobo bigint not null default 0 check (paid_amount_kobo >= 0),
    add column if not exists reopened_at timestamptz,
    add column if not exists reopened_by uuid references profiles(id),
    add column if not exists reopen_reason text;

-- Update default expiry to 7 hours
alter table if exists orders
    alter column expires_at set default (now() + interval '7 hours');

-- Expand order status check constraint to support full manual transfer lifecycle
alter table if exists orders drop constraint if exists orders_status_check;
alter table if exists orders
    add constraint orders_status_check check (status in (
        'pending_payment',
        'proof_submitted',
        'partial',
        'paid',
        'payment_confirmed',
        'in_kitchen',
        'ready_for_dispatch',
        'out_for_delivery',
        'delivered',
        'expired',
        'rejected',
        'cancelled'
    ));

-- Ensure trigger blocks confirming expired orders unless explicitly reopened
create or replace function check_order_not_expired_before_payment()
returns trigger as $$
begin
    if (NEW.status in ('paid', 'payment_confirmed')) and (OLD.status in ('pending_payment', 'proof_submitted', 'expired', 'partial')) then
        if OLD.expires_at < now() and NEW.reopened_at is null and OLD.reopened_at is null then
            raise exception 'Cannot confirm payment on expired order %. Admin must explicitly reopen it first.', OLD.order_code;
        end if;
    end if;
    return NEW;
end;
$$ language plpgsql;

-- 3. Order payment proofs ledger (unique payment reference + unique receipt hash across orders)
create table if not exists order_payment_proofs (
    id uuid primary key default gen_random_uuid(),
    order_id uuid not null references orders(id) on delete cascade,
    payment_reference text not null check (length(trim(payment_reference)) >= 6),
    sender_name text not null check (length(trim(sender_name)) >= 2),
    transfer_time timestamptz not null,
    receipt_mime_type text check (receipt_mime_type is null or receipt_mime_type in ('image/jpeg', 'image/png', 'application/pdf')),
    receipt_size_bytes integer check (receipt_size_bytes is null or (receipt_size_bytes > 0 and receipt_size_bytes <= 5242880)),
    receipt_sha256 text check (receipt_sha256 is null or receipt_sha256 ~ '^[0-9a-f]{64}$'),
    status text not null default 'proof_submitted' check (status in ('proof_submitted', 'partial', 'paid', 'rejected')),
    submitted_by_ip_hash text,
    created_at timestamptz not null default now()
);

create unique index if not exists idx_unique_receipt_sha256_cross_order
    on order_payment_proofs(receipt_sha256)
    where receipt_sha256 is not null;

create index if not exists idx_proofs_order_id on order_payment_proofs(order_id);
create index if not exists idx_proofs_payment_ref on order_payment_proofs(payment_reference);

-- 4. Explicit admin reopen log for expired orders
create table if not exists order_reopen_logs (
    id uuid primary key default gen_random_uuid(),
    order_id uuid not null references orders(id) on delete cascade,
    reopened_by uuid not null references profiles(id),
    reason text not null check (length(trim(reason)) >= 3),
    previous_expires_at timestamptz not null,
    new_expires_at timestamptz not null,
    created_at timestamptz not null default now()
);

-- 5. Seed / Upsert Official GTBank Settings (account_number strictly 10-digit string) & DB Ops Settings
insert into business_settings (key, value)
values
    (
        'bank_transfer_details',
        jsonb_build_object(
            'bankName', 'Guaranty Trust Bank (GTBank)',
            'accountName', 'Esther Kwentua',
            'accountNumber', '0013190627',
            'verifiedByOwner', true
        )
    ),
    (
        'ops_settings',
        jsonb_build_object(
            'invoiceRequestsPaused', false,
            'whatsappSendPaused', false
        )
    )
on conflict (key) do update set
    value = excluded.value,
    updated_at = now();

-- Ensure stored bank_transfer_details accountNumber is always a 10-digit string when present
alter table if exists business_settings drop constraint if exists chk_bank_account_number_10_digits;
alter table if exists business_settings
    add constraint chk_bank_account_number_10_digits check (
        key <> 'bank_transfer_details'
        or value is null
        or ((value->>'accountNumber') ~ '^[0-9]{10}$')
    );

-- RLS for new tables
alter table order_payment_proofs enable row level security;
alter table order_reopen_logs enable row level security;

drop policy if exists order_proofs_admin_all on order_payment_proofs;
create policy order_proofs_admin_all on order_payment_proofs
    for all to authenticated
    using (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('owner', 'staff', 'developer') and p.is_active = true))
    with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('owner', 'staff', 'developer') and p.is_active = true));

drop policy if exists order_reopen_logs_admin_all on order_reopen_logs;
create policy order_reopen_logs_admin_all on order_reopen_logs
    for all to authenticated
    using (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('owner', 'staff', 'developer') and p.is_active = true))
    with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('owner', 'staff', 'developer') and p.is_active = true));
