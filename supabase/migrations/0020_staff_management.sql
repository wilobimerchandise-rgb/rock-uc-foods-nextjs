-- ============================================================================
-- ROCK UC FOODS - Phase 1E: Staff & User Management
-- 0020_staff_management.sql
-- ============================================================================

-- 1. Ensure profiles table role and active status constraints
do $$
begin
    alter table profiles drop constraint if exists profiles_role_check;
    alter table profiles add constraint profiles_role_check 
        check (role in ('owner', 'staff', 'developer'));
exception
    when others then null;
end $$;

-- 2. Indexes for user directory queries
create index if not exists profiles_role_is_active_idx on profiles(role, is_active);

-- 3. Row Level Security policies for user management
alter table profiles enable row level security;

-- Drop existing overlapping policies if any
drop policy if exists profiles_owner_manage_all on profiles;
create policy profiles_owner_manage_all on profiles
    for all
    to authenticated
    using (
        exists (
            select 1 from profiles p
            where p.id = auth.uid()
            and p.role = 'owner'
            and p.is_active = true
        )
    )
    with check (
        exists (
            select 1 from profiles p
            where p.id = auth.uid()
            and p.role = 'owner'
            and p.is_active = true
        )
    );

drop policy if exists profiles_self_read on profiles;
create policy profiles_self_read on profiles
    for select
    to authenticated
    using (
        id = auth.uid()
    );

-- 4. Safety Trigger: Prevent deactivation of the last remaining active owner
create or replace function check_last_active_owner()
returns trigger as $$
declare
    active_owners_count int;
begin
    -- If an owner is being deactivated or having their role changed
    if old.role = 'owner' and (new.is_active = false or new.role != 'owner') then
        select count(*) into active_owners_count
        from profiles
        where role = 'owner' and is_active = true and id != old.id;

        if active_owners_count = 0 then
            raise exception 'Cannot deactivate or change the role of the last remaining active owner.';
        end if;
    end if;

    return new;
end;
$$ language plpgsql;

drop trigger if exists trg_prevent_deactivating_last_owner on profiles;
create trigger trg_prevent_deactivating_last_owner
    before update on profiles
    for each row
    execute function check_last_active_owner();
