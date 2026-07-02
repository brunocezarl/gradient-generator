-- ShaderCanvas Studio — Phase 2 schema
-- Run this in the Supabase SQL Editor (Dashboard → SQL → New query).

-- ---------------------------------------------------------------------------
-- Projects: one row per saved scene owned by a user
-- ---------------------------------------------------------------------------
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null default 'Untitled project',
  scene_json jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz
);

create index if not exists projects_user_id_idx on public.projects (user_id);
create index if not exists projects_published_at_idx on public.projects (published_at)
  where published_at is not null;

-- Auto-update updated_at on every save
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists projects_set_updated_at on public.projects;
create trigger projects_set_updated_at
  before update on public.projects
  for each row
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security — users own their projects; published scenes are public
-- ---------------------------------------------------------------------------
alter table public.projects enable row level security;

drop policy if exists "Users can view own projects" on public.projects;
create policy "Users can view own projects"
  on public.projects for select
  using (auth.uid() = user_id);

drop policy if exists "Public can view published projects" on public.projects;
create policy "Public can view published projects"
  on public.projects for select
  using (published_at is not null);

drop policy if exists "Users can insert own projects" on public.projects;
create policy "Users can insert own projects"
  on public.projects for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own projects" on public.projects;
create policy "Users can update own projects"
  on public.projects for update
  using (auth.uid() = user_id);

drop policy if exists "Users can delete own projects" on public.projects;
create policy "Users can delete own projects"
  on public.projects for delete
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Assets metadata (optional — tracks uploads; scene JSON stores the public URL)
-- ---------------------------------------------------------------------------
create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  storage_path text not null,
  public_url text not null,
  mime_type text,
  size_bytes bigint,
  created_at timestamptz not null default now()
);

create index if not exists assets_user_id_idx on public.assets (user_id);

alter table public.assets enable row level security;

drop policy if exists "Users can view own assets" on public.assets;
create policy "Users can view own assets"
  on public.assets for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own assets" on public.assets;
create policy "Users can insert own assets"
  on public.assets for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own assets" on public.assets;
create policy "Users can delete own assets"
  on public.assets for delete
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Storage bucket for image layers (public read so embeds can load assets)
-- Create the bucket if it doesn't exist yet.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('scene-assets', 'scene-assets', true)
on conflict (id) do nothing;

drop policy if exists "Authenticated users upload to own folder" on storage.objects;
create policy "Authenticated users upload to own folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'scene-assets'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Public read scene assets" on storage.objects;
create policy "Public read scene assets"
  on storage.objects for select
  using (bucket_id = 'scene-assets');

drop policy if exists "Users delete own scene assets" on storage.objects;
create policy "Users delete own scene assets"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'scene-assets'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
