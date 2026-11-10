-- ============================================================================
-- ROCK UC FOODS - Phase 3 Orders Enhancement Migration
-- 0016_order_options_and_tiers.sql
-- Enforces 15-minute order expiry, size tiers, and option snapshots
-- ============================================================================

-- 1. Add 15-minute expiry to orders table
alter table if exists orders
    add column if not exists expires_at timestamptz not null default (now() + interval '15 minutes');

create index if not exists orders_expires_at_idx on orders(expires_at);

-- 2. Add tier name and options snapshot to order_items
alter table if exists order_items
    add column if not exists selected_tier_name text,
    add column if not exists selected_options_snapshot jsonb not null default '[]'::jsonb;

-- 3. Trigger preventing payment confirmation on expired orders
create or replace function check_order_not_expired_before_payment()
returns trigger as $$
begin
    if NEW.status = 'payment_confirmed' and OLD.status = 'pending_payment' then
        if OLD.expires_at < now() then
            raise exception 'Cannot confirm payment on expired order %. Order expired at %', OLD.order_code, OLD.expires_at;
        end if;
    end if;
    return NEW;
end;
$$ language plpgsql;

drop trigger if exists trg_check_order_not_expired on orders;
create trigger trg_check_order_not_expired
before update on orders
for each row
execute function check_order_not_expired_before_payment();
