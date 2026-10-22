-- ============================================================================
-- ROCK UC FOODS - Phase 8 Playbook v2 Alignment Migration
-- 0009_playbook_v2_alignment.sql
-- Enables exact execution of Section 14 Verification Queries 1-11
-- ============================================================================

-- 1. Ensure orders table has ref and public_token columns aligned with Section 14 queries
alter table orders add column if not exists ref text unique;
alter table orders add column if not exists public_token text unique check (public_token is null or public_token ~ '^[0-9a-f]{32}$');
alter table orders add column if not exists expires_at timestamptz;
alter table orders add column if not exists order_status text default 'pending_payment';
alter table orders add column if not exists payment_status text default 'unpaid';

-- Sync existing rows
update orders set ref = order_code where ref is null;
update orders set public_token = tracking_token where public_token is null and tracking_token ~ '^[0-9a-f]{32}$';
update orders set order_status = status where order_status is null;

-- Ensure order_items has unit_price_kobo and line_total_kobo for Section 14 queries 1 and 2
alter table order_items add column if not exists unit_price_kobo bigint;
alter table order_items add column if not exists line_total_kobo bigint;
update order_items set unit_price_kobo = unit_price_kobo_snapshot where unit_price_kobo is null;
update order_items set line_total_kobo = total_kobo_snapshot where line_total_kobo is null;

-- Ensure payment_records has fee_kobo and bank_reference columns
alter table payment_records add column if not exists fee_kobo bigint default 0;
alter table payment_records add column if not exists bank_reference text;

-- 2. Create compatibility view 'payments' pointing to 'payment_records' for Section 14 Query 4, 5, 6, 7
create or replace view payments as
select 
    id,
    order_id,
    invoice_id,
    payment_type,
    method,
    case when method = 'manual_transfer' then 'manual' else 'paystack' end as provider,
    provider_reference as provider_ref,
    amount_kobo,
    fee_kobo,
    case 
        when status = 'verified' then 'verified'
        when status = 'failed' then 'failed'
        when status = 'reversed' then 'reversed'
        else 'awaiting_verification'
    end as status,
    verified_by,
    verified_at,
    bank_reference,
    created_at
from payment_records;

-- 3. Ensure receipts table payment_id column is uuid for Query 7 join
alter table receipts alter column payment_id type uuid using payment_id::uuid;
