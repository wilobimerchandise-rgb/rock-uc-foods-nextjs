-- ============================================================================
-- ROCK UC FOODS - Phase 2A: Search-Ready, Owner-Editable Public Site
-- 0014_site_content.sql
-- Append-only versioned site content table with strict immutability triggers
-- ============================================================================

create table if not exists site_content_versions (
    version integer primary key check (version >= 1),
    content jsonb not null check (jsonb_typeof(content) = 'object'),
    note text check (char_length(note) <= 200),
    created_by text not null default 'owner@rockucfoods.com',
    created_at timestamptz not null default now()
);

-- Immutability trigger: refuse UPDATE, DELETE, TRUNCATE
create or replace function refuse_site_content_mutation()
returns trigger as $$
begin
    raise exception 'site_content_versions is append-only and cannot be updated, deleted, or truncated.';
end;
$$ language plpgsql;

drop trigger if exists trg_refuse_site_content_update on site_content_versions;
create trigger trg_refuse_site_content_update
before update on site_content_versions
for each row execute function refuse_site_content_mutation();

drop trigger if exists trg_refuse_site_content_delete on site_content_versions;
create trigger trg_refuse_site_content_delete
before delete on site_content_versions
for each row execute function refuse_site_content_mutation();

-- Seed version 1 default content
insert into site_content_versions (version, content, note, created_by)
values (
    1,
    '{
        "contact": {
            "whatsapp": "+2348033729125",
            "phone": "08033729125",
            "showEmail": false,
            "email": "rock-uc-foods@gmail.com",
            "showAddress": false,
            "address": "5 Aro street, Lagos",
            "city": "Lagos"
        },
        "hours": {
            "orderingOpen247": true,
            "kitchenNote": "Fresh dishes cooked to order daily; kitchen operates standard daytime service.",
            "leadTimeHours": 24
        },
        "sections": [
            {"categorySlug": "party-jollof", "displayName": "The Jollof Table", "plainLabel": "Party Jollof and Fried Rice", "sortOrder": 1},
            {"categorySlug": "soups-swallow", "displayName": "Heritage Pots", "plainLabel": "Soups and Swallow", "sortOrder": 2},
            {"categorySlug": "pepper-soup", "displayName": "First Fire", "plainLabel": "Pepper Soup and Starters", "sortOrder": 3},
            {"categorySlug": "suya-grills", "displayName": "Smoke and Spice", "plainLabel": "Suya and Grills", "sortOrder": 4},
            {"categorySlug": "party-packs", "displayName": "Feast for the Table", "plainLabel": "Party Packs and Catering", "sortOrder": 5},
            {"categorySlug": "sides-extras", "displayName": "Side Stories", "plainLabel": "Sides and Extras", "sortOrder": 6},
            {"categorySlug": "desserts", "displayName": "Sweet Endings", "plainLabel": "Desserts and Small Chops", "sortOrder": 7},
            {"categorySlug": "drinks", "displayName": "Cool Pours", "plainLabel": "Drinks", "sortOrder": 8}
        ],
        "reviews": []
    }'::jsonb,
    'Initial seeded version 1 site content',
    'system-seed'
)
on conflict (version) do nothing;
