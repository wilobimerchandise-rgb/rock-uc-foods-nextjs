-- ============================================================================
-- ROCK UC FOODS - Phase 2B Menu Motion, Options, and Size Tiers Schema
-- 0015_menu_options_and_tiers.sql
-- Playbook v9 Section 26 (Pages 76–81)
-- ============================================================================

-- 1. Extend menu_items with heat, availability, and photo attributes
alter table menu_items
    add column if not exists show_heat boolean not null default false,
    add column if not exists availability_note text check (availability_note is null or length(availability_note) <= 120),
    add column if not exists photo_url text null;

-- Drop old check constraint to permit size-tiered published items (price_kobo = 0 with size_tiers)
alter table menu_items drop constraint if exists menu_items_price_safety_chk;

-- 2. Option Groups (e.g. "Choose one swallow", "Choose one protein")
create table if not exists option_groups (
    id uuid primary key default gen_random_uuid(),
    item_id uuid not null references menu_items(id) on delete cascade,
    title text not null check (length(title) between 1 and 60),
    min_choices int not null default 1 check (min_choices >= 0),
    max_choices int not null default 1 check (max_choices >= min_choices),
    sort_order int not null default 0,
    created_at timestamptz not null default now()
);

-- 3. Options with integer extra_kobo
create table if not exists options (
    id uuid primary key default gen_random_uuid(),
    group_id uuid not null references option_groups(id) on delete cascade,
    label text not null check (length(label) between 1 and 60),
    extra_kobo bigint not null default 0 check (extra_kobo >= 0 and extra_kobo <= 10000000000),
    active boolean not null default true,
    sort_order int not null default 0,
    created_at timestamptz not null default now()
);

-- 4. Size Tiers (e.g. S, M, L, Single pack, Family pack)
create table if not exists size_tiers (
    id uuid primary key default gen_random_uuid(),
    item_id uuid not null references menu_items(id) on delete cascade,
    label text not null check (length(label) between 1 and 20),
    price_kobo bigint not null check (price_kobo > 0 and price_kobo <= 10000000000),
    active boolean not null default true,
    sort_order int not null default 0,
    created_at timestamptz not null default now()
);

create index if not exists option_groups_item_idx on option_groups(item_id);
create index if not exists options_group_idx on options(group_id);
create index if not exists size_tiers_item_idx on size_tiers(item_id);

-- 5. Trigger constraint: An item has either a base price or size tiers, never both
create or replace function check_item_base_price_or_tiers()
returns trigger as $$
declare
    v_base_price bigint;
    v_tier_count int;
begin
    if tg_table_name = 'size_tiers' then
        select price_kobo into v_base_price
        from menu_items
        where id = new.item_id;

        if v_base_price is not null and v_base_price > 0 then
            raise exception 'Item cannot have both a base price and size tiers';
        end if;
        return new;
    end if;

    if tg_table_name = 'menu_items' then
        if new.price_kobo > 0 then
            select count(*) into v_tier_count
            from size_tiers
            where item_id = new.id;

            if v_tier_count > 0 then
                raise exception 'Item cannot have both a base price and size tiers';
            end if;
        end if;
        return new;
    end if;

    return new;
end;
$$ language plpgsql;

drop trigger if exists trg_size_tiers_exclusive_price on size_tiers;
create trigger trg_size_tiers_exclusive_price
    before insert or update on size_tiers
    for each row
    execute function check_item_base_price_or_tiers();

drop trigger if exists trg_menu_items_exclusive_price on menu_items;
create trigger trg_menu_items_exclusive_price
    before insert or update of price_kobo on menu_items
    for each row
    execute function check_item_base_price_or_tiers();

-- 6. Row Level Security: public reads active rows; only owner with 2FA writes
alter table option_groups enable row level security;
alter table options enable row level security;
alter table size_tiers enable row level security;

-- Public can read all option groups for published items
drop policy if exists option_groups_public_read on option_groups;
create policy option_groups_public_read on option_groups
    for select using (
        exists (
            select 1 from menu_items
            where menu_items.id = option_groups.item_id
              and menu_items.status = 'published'
        )
    );

-- Public can read active options
drop policy if exists options_public_read on options;
create policy options_public_read on options
    for select using (active = true);

-- Public can read active size tiers
drop policy if exists size_tiers_public_read on size_tiers;
create policy size_tiers_public_read on size_tiers
    for select using (active = true);
