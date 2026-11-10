-- ============================================================================
-- ROCK UC FOODS - Phase 1D Addendum: Invoice Revisions & Versioning
-- 0019_invoice_revisions.sql
-- ============================================================================

-- 1. Ensure invoices status check constraint supports 'superseded'
do $$
begin
    alter table invoices drop constraint if exists invoices_status_check;
    alter table invoices add constraint invoices_status_check 
        check (status in ('draft', 'issued', 'void', 'superseded'));
exception
    when others then null;
end $$;

-- 2. Ensure invoice_versions table exists with revision snapshot tracking
create table if not exists invoice_versions (
    id bigint generated always as identity primary key,
    invoice_id uuid not null references invoices(id) on delete cascade,
    version int not null check (version >= 1),
    snapshot jsonb not null,
    reason text not null check (length(reason) >= 3),
    changed_by uuid references profiles(id),
    changed_at timestamptz not null default now()
);

create index if not exists invoice_versions_invoice_id_idx on invoice_versions(invoice_id);

-- 3. Row Level Security for invoice_versions
alter table invoice_versions enable row level security;

drop policy if exists invoice_versions_owner_select on invoice_versions;
create policy invoice_versions_owner_select on invoice_versions
    for select
    to authenticated
    using (
        exists (
            select 1 from profiles
            where profiles.id = auth.uid()
            and profiles.role in ('owner', 'staff', 'developer')
        )
    );

drop policy if exists invoice_versions_owner_insert on invoice_versions;
create policy invoice_versions_owner_insert on invoice_versions
    for insert
    to authenticated
    with check (
        exists (
            select 1 from profiles
            where profiles.id = auth.uid()
            and profiles.role = 'owner'
        )
    );

-- 4. Append-Only Trigger on invoice_versions (UPDATE and DELETE strictly forbidden)
create or replace function prevent_invoice_versions_mutation()
returns trigger as $$
begin
    raise exception 'invoice_versions is strictly append-only. UPDATE and DELETE operations are forbidden.';
end;
$$ language plpgsql;

drop trigger if exists trg_prevent_invoice_versions_mutation on invoice_versions;
create trigger trg_prevent_invoice_versions_mutation
    before update or delete or truncate on invoice_versions
    for each statement
    execute function prevent_invoice_versions_mutation();
