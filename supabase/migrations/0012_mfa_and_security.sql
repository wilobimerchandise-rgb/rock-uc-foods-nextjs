-- ============================================================================
-- ROCK UC FOODS - Phase 3: MFA, Step-Up Security & Hardening
-- 0012_mfa_and_security.sql
-- ============================================================================

-- 1. User MFA credentials
create table if not exists user_mfa_credentials (
    user_id text primary key,
    secret text not null,
    is_enabled boolean not null default false,
    backup_codes text[] not null default array[]::text[],
    last_used_step bigint not null default 0,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- 2. Step-up challenge sessions (ephemeral authorization for high-risk actions)
create table if not exists step_up_sessions (
    token text primary key,
    user_id text not null,
    purpose text not null,
    expires_at bigint not null,
    created_at timestamptz not null default now()
);

-- 3. Security audit events
create table if not exists security_audit_events (
    id uuid primary key default gen_random_uuid(),
    actor_user_id text not null,
    actor_role text not null check (actor_role in ('owner', 'staff', 'developer', 'system')),
    event_type text not null,
    ip_address text,
    details jsonb default '{}'::jsonb,
    created_at timestamptz not null default now()
);

create index if not exists idx_mfa_user on user_mfa_credentials(user_id);
create index if not exists idx_step_up_user on step_up_sessions(user_id);
create index if not exists idx_sec_audit_actor on security_audit_events(actor_user_id);
create index if not exists idx_sec_audit_event on security_audit_events(event_type);
