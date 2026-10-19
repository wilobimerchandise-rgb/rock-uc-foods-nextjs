-- ============================================================================
-- ROCK UC FOODS - Phase 2 Menu Schema Migration
-- 0002_menu_core.sql
-- ============================================================================

-- 1. Menu Categories
create table if not exists menu_categories (
    id uuid primary key default gen_random_uuid(),
    name text not null check (length(name) between 1 and 60),
    sort_order int not null default 0,
    is_visible boolean not null default true,
    version int not null default 1
);

create unique index if not exists menu_categories_name_uq on menu_categories (lower(name));

-- 2. Menu Items (Strictly bigint kobo)
create table if not exists menu_items (
    id uuid primary key default gen_random_uuid(),
    sku text unique,
    category_id uuid not null references menu_categories(id) on delete restrict,
    name text not null check (length(name) between 1 and 80),
    description text check (length(description) <= 500),
    price_kobo bigint not null check (price_kobo >= 0 and price_kobo <= 100000000000),
    portion_label text,
    allergens text[] not null default '{}',
    image_path text,
    image_alt text,
    status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
    is_available boolean not null default true,
    sold_out_until timestamptz,
    is_featured boolean not null default false,
    is_free_item boolean not null default false,
    sort_order int not null default 0,
    version int not null default 1,
    updated_by uuid references profiles(id),
    updated_at timestamptz not null default now()
);

create unique index if not exists menu_items_cat_name_uq on menu_items (category_id, lower(name));

-- Price Safety Constraint: published items must have price_kobo > 0 unless explicitly marked is_free_item
alter table menu_items drop constraint if exists menu_items_price_safety_chk;
alter table menu_items add constraint menu_items_price_safety_chk check (
    status != 'published' or price_kobo > 0 or is_free_item = true
);

-- 3. Option Groups (e.g. Protein Choice, Extra Sauce)
create table if not exists menu_option_groups (
    id uuid primary key default gen_random_uuid(),
    item_id uuid not null references menu_items(id) on delete cascade,
    name text not null,
    min_select int not null default 0,
    max_select int not null default 1,
    check (max_select >= min_select)
);

-- 4. Menu Options with price deltas in kobo
create table if not exists menu_options (
    id uuid primary key default gen_random_uuid(),
    group_id uuid not null references menu_option_groups(id) on delete cascade,
    name text not null,
    price_delta_kobo bigint not null default 0 check (price_delta_kobo >= 0),
    is_available boolean not null default true,
    sort_order int not null default 0
);

-- 5. Immutable Item Version History for 1-Tap Restore
create table if not exists menu_item_versions (
    id bigint generated always as identity primary key,
    item_id uuid not null references menu_items(id),
    version int not null,
    snapshot jsonb not null,
    changed_by uuid references profiles(id),
    changed_at timestamptz not null default now()
);

-- RLS: Public can read published items in visible categories; owner manages all
alter table menu_categories enable row level security;
alter table menu_items enable row level security;
alter table menu_option_groups enable row level security;
alter table menu_options enable row level security;
alter table menu_item_versions enable row level security;

create policy public_view_categories on menu_categories
    for select using (is_visible = true);

create policy public_view_items on menu_items
    for select using (status = 'published');

create policy public_view_options on menu_options
    for select using (is_available = true);
