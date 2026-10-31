-- ============================================================================
-- ROCK UC FOODS - Phase 5: Automated Notifications & Outbox Queue
-- 0013_notifications_outbox.sql
-- ============================================================================

create table if not exists notification_outbox (
    id uuid primary key default gen_random_uuid(),
    recipient_phone text not null,
    recipient_name text not null,
    order_id uuid references orders(id) on delete set null,
    invoice_id uuid references invoices(id) on delete set null,
    event_type text not null,
    channel text not null check (channel in ('whatsapp', 'sms', 'in_app')),
    message text not null,
    whatsapp_url text,
    status text not null check (status in ('pending', 'sent', 'failed')),
    provider_ref text,
    error_message text,
    created_at timestamptz not null default now(),
    sent_at timestamptz
);

create index if not exists idx_notif_order on notification_outbox(order_id);
create index if not exists idx_notif_invoice on notification_outbox(invoice_id);
create index if not exists idx_notif_phone on notification_outbox(recipient_phone);
create index if not exists idx_notif_status on notification_outbox(status);
