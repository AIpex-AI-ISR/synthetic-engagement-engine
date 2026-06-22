-- Synthetic Engagement Engine — Supabase schema
-- Mirrors the former base44/entities/*.jsonc definitions.
-- Run this against a fresh Supabase project (SQL Editor, or `supabase db push`).

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- profiles (replaces base44's built-in User entity)
-- One row per auth.users row, created automatically on signup.
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  prepaid_token_balance numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- company_profiles
-- ---------------------------------------------------------------------------
create table public.company_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles (id) on delete cascade,
  company_name text,
  company_summary text,
  source_file_url text,
  source_file_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- connections (Gmail / Google Calendar / WhatsApp)
-- ---------------------------------------------------------------------------
create table public.connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  provider text not null check (provider in ('gmail', 'google_calendar', 'outlook', 'whatsapp')),
  status text not null default 'disconnected' check (status in ('disconnected', 'pending', 'connected')),
  external_label text,
  connected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);

-- ---------------------------------------------------------------------------
-- personas
-- ---------------------------------------------------------------------------
create table public.personas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  job_title text,
  company text,
  background_summary text,
  background_detailed text,
  status text not null default 'Draft' check (status in ('Draft', 'Active')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- campaigns (owned via persona_id -> personas.user_id)
-- ---------------------------------------------------------------------------
create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  persona_id uuid not null references public.personas (id) on delete cascade,
  goal text not null,
  active_days text[] not null default '{}',
  target_meeting_date date,
  calendar_sync_status boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- messages (owned via campaign_id -> campaigns.persona_id -> personas.user_id)
-- ---------------------------------------------------------------------------
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  sender text not null check (sender in ('System', 'Client')),
  message_body text not null,
  token_cost numeric not null default 0,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------
create function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.company_profiles
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.connections
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.personas
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.campaigns
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.company_profiles enable row level security;
alter table public.connections enable row level security;
alter table public.personas enable row level security;
alter table public.campaigns enable row level security;
alter table public.messages enable row level security;

create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

create policy "company_profiles_all_own" on public.company_profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "connections_all_own" on public.connections
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "personas_all_own" on public.personas
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "campaigns_all_own" on public.campaigns
  for all using (
    exists (
      select 1 from public.personas
      where personas.id = campaigns.persona_id
        and personas.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.personas
      where personas.id = campaigns.persona_id
        and personas.user_id = auth.uid()
    )
  );

create policy "messages_all_own" on public.messages
  for all using (
    exists (
      select 1 from public.campaigns
      join public.personas on personas.id = campaigns.persona_id
      where campaigns.id = messages.campaign_id
        and personas.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.campaigns
      join public.personas on personas.id = campaigns.persona_id
      where campaigns.id = messages.campaign_id
        and personas.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Storage: company files uploaded on the Profile page (replaces UploadFile)
-- Objects must be stored under a path prefixed with the owner's auth.uid(),
-- e.g. `${user.id}/company-file.pdf`.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('company-files', 'company-files', false)
on conflict (id) do nothing;

create policy "company_files_owner_rw" on storage.objects
  for all using (
    bucket_id = 'company-files'
    and auth.uid()::text = (storage.foldername(name))[1]
  )
  with check (
    bucket_id = 'company-files'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- ---------------------------------------------------------------------------
-- oauth_tokens
-- Raw OAuth tokens for the Gmail / Google Calendar / Outlook connectors.
-- Kept separate from `connections` (which the frontend reads directly with
-- the anon/publishable key) so access tokens and refresh tokens are never
-- selectable from the browser, even under RLS misconfiguration.
-- ---------------------------------------------------------------------------
create table public.oauth_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  provider text not null check (provider in ('gmail', 'google_calendar', 'outlook')),
  access_token text not null,
  refresh_token text,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);

alter table public.oauth_tokens enable row level security;
-- Deliberately no policy for the authenticated/anon role: only the
-- service-role key (used server-side in Edge Functions) can read or
-- write this table, so raw OAuth tokens are never exposed to the browser.
