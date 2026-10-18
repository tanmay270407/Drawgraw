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

-- Public library catalog used by the Drawgraw Libraries page. Library files
-- live in the public `drawgraw-libraries` Storage bucket.
create table if not exists public.drawgraw_libraries (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  description text not null default '',
  author_name text not null default 'Drawgraw creator',
  storage_path text not null unique,
  item_count integer not null,
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  constraint drawgraw_libraries_title_length check (char_length(title) between 2 and 80),
  constraint drawgraw_libraries_description_length check (char_length(description) <= 500),
  constraint drawgraw_libraries_author_length check (char_length(author_name) between 1 and 80),
  constraint drawgraw_libraries_item_count check (item_count between 1 and 100),
  constraint drawgraw_libraries_storage_owner_path check (
    split_part(storage_path, '/', 1) = owner_id::text
  )
);

create index if not exists drawings_owner_updated_at_idx
  on public.drawings (owner_id, updated_at desc);
create index if not exists drawgraw_libraries_public_created_at_idx
  on public.drawgraw_libraries (created_at desc)
  where is_public;

alter table public.profiles enable row level security;
alter table public.drawings enable row level security;
alter table public.drawgraw_libraries enable row level security;

-- Explicit grants are required on projects where new public tables are not
-- automatically exposed to the Supabase Data API.
grant usage on schema public to authenticated;
grant select, insert, update on table public.profiles to authenticated;
grant select, insert, update, delete on table public.drawings to authenticated;
grant select on table public.drawgraw_libraries to anon, authenticated;
grant insert, update, delete on table public.drawgraw_libraries to authenticated;
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

drop policy if exists "Anyone can read published Drawgraw libraries" on public.drawgraw_libraries;
create policy "Anyone can read published Drawgraw libraries"
  on public.drawgraw_libraries for select to anon, authenticated
  using (is_public or (select auth.uid()) = owner_id);

drop policy if exists "Users can publish their own Drawgraw libraries" on public.drawgraw_libraries;
create policy "Users can publish their own Drawgraw libraries"
  on public.drawgraw_libraries for insert to authenticated
  with check ((select auth.uid()) = owner_id and is_public);

drop policy if exists "Users can update their own Drawgraw libraries" on public.drawgraw_libraries;
create policy "Users can update their own Drawgraw libraries"
  on public.drawgraw_libraries for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

drop policy if exists "Users can delete their own Drawgraw libraries" on public.drawgraw_libraries;
create policy "Users can delete their own Drawgraw libraries"
  on public.drawgraw_libraries for delete to authenticated
  using ((select auth.uid()) = owner_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'drawgraw-libraries',
  'drawgraw-libraries',
  true,
  5242880,
  array['application/json']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Anyone can read public Drawgraw library files" on storage.objects;
create policy "Anyone can read public Drawgraw library files"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'drawgraw-libraries');

drop policy if exists "Users can upload their own Drawgraw library files" on storage.objects;
create policy "Users can upload their own Drawgraw library files"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'drawgraw-libraries'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Users can delete their own Drawgraw library files" on storage.objects;
create policy "Users can delete their own Drawgraw library files"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'drawgraw-libraries'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
