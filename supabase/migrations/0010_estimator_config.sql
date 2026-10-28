-- ============================================================================
-- ROCK UC FOODS - Phase 1C: Owner-Editable Catering Estimator
-- 0010_estimator_config.sql
-- Single source of truth for catering tiers, add-ons, and service rates
-- ============================================================================

create table if not exists estimator_config (
    id text primary key default 'default',
    version integer not null default 1,
    tiers jsonb not null,
    add_ons jsonb not null,
    service_rates jsonb not null,
    updated_at timestamptz not null default now(),
    updated_by text not null default 'owner@rockucfoods.com'
);

-- Ensure singleton row
insert into estimator_config (id, version, tiers, add_ons, service_rates)
values (
    'default',
    1,
    '[
        {"id": "tier-bronze", "name": "Bronze Feast", "description": "Classic party jollof, proteins, sides, and chilled zobo", "pricePerGuestKobo": "1250000", "minGuests": 20, "maxGuests": 50, "isDefault": true},
        {"id": "tier-silver", "name": "Silver Banquet", "description": "Smoky jollof, fried rice, premium goat meat, chicken, and moin-moin", "pricePerGuestKobo": "1850000", "minGuests": 51, "maxGuests": 150},
        {"id": "tier-gold", "name": "Gold Royal", "description": "Full traditional spread: ofada, egusi, seafood okra, fresh fish, and small chops", "pricePerGuestKobo": "2600000", "minGuests": 151, "maxGuests": 300},
        {"id": "tier-platinum", "name": "Platinum Sovereign", "description": "Executive live cooking, carving stations, grilled jumbo prawns, and bespoke gourmet dining", "pricePerGuestKobo": "3500000", "minGuests": 301, "maxGuests": 1000}
    ]'::jsonb,
    '[
        {"id": "addon-smallchops", "name": "Live Small Chops Bar", "description": "Hot samosas, spring rolls, puff-puff, and gizdodo prepared on-site", "unitPriceKobo": "350000", "pricingModel": "per_guest"},
        {"id": "addon-dessert", "name": "Luxury Dessert Buffet", "description": "Artisan cakes, fruit parfaits, and bespoke sweet treats", "unitPriceKobo": "450000", "pricingModel": "per_guest"},
        {"id": "addon-butlers", "name": "Uniformed Butler & Server Team", "description": "Professional banquet service staff for up to 6 hours", "unitPriceKobo": "15000000", "pricingModel": "flat"},
        {"id": "addon-tableware", "name": "Chafing & Premium Tableware Setup", "description": "Luxury chafing dishes, golden cutlery, and fine dining tableware", "unitPriceKobo": "10000000", "pricingModel": "flat"}
    ]'::jsonb,
    '{
        "serviceChargeBps": 1000,
        "baseLogisticsKobo": "5000000",
        "minDepositBps": 7000
    }'::jsonb
)
on conflict (id) do nothing;
