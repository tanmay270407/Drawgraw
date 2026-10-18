-- Drawgraw account and cloud-drawing schema.
-- Run this complete script in the Supabase SQL Editor.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  phone_number text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- These ALTERs also upgrade a project that already ran the earlier profile SQL.
alter table public.profiles
  add column if not exists phone_number text not null default '';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_phone_number_length'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_phone_number_length
      check (phone_number = '' or char_length(phone_number) between 7 and 32);
  end if;
end
$$;

create table if not exists public.drawings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  title text not null default 'Untitled drawing',
  scene jsonb not null default '{"elements":[],"appState":{},"files":{}}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint drawings_title_length check (char_length(title) between 1 and 120),
  constraint drawings_scene_is_object check (jsonb_typeof(scene) = 'object')
);

create index if not exists drawings_owner_updated_at_idx
  on public.drawings (owner_id, updated_at desc);

alter table public.profiles enable row level security;
alter table public.drawings enable row level security;

-- Explicit grants are required on projects where new public tables are not
-- automatically exposed to the Supabase Data API.
grant usage on schema public to authenticated;
grant select, insert, update on table public.profiles to authenticated;
grant select, insert, update, delete on table public.drawings to authenticated;
revoke all on table public.profiles from anon;
revoke all on table public.drawings from anon;

drop policy if exists "Users can read their own profile" on public.profiles;
create policy "Users can read their own profile"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "Users can create their own profile" on public.profiles;
create policy "Users can create their own profile"
  on public.profiles for insert to authenticated
  with check ((select auth.uid()) = id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists "Users can read their own drawings" on public.drawings;
create policy "Users can read their own drawings"
  on public.drawings for select to authenticated
  using ((select auth.uid()) = owner_id);

drop policy if exists "Users can create their own drawings" on public.drawings;
create policy "Users can create their own drawings"
  on public.drawings for insert to authenticated
  with check ((select auth.uid()) = owner_id);

drop policy if exists "Users can update their own drawings" on public.drawings;
create policy "Users can update their own drawings"
  on public.drawings for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

drop policy if exists "Users can delete their own drawings" on public.drawings;
create policy "Users can delete their own drawings"
  on public.drawings for delete to authenticated
  using ((select auth.uid()) = owner_id);
